"""Admin module: dashboard, users, sellers, orders, returns and reports.
Every route here needs an admin login. Customers and sellers get 403."""
import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..emailer import send_email
from ..models import (User, Seller, SellerDocument, Product, Category, Order, OrderItem,
                      OrderStatusHistory, ReturnRequest)
from ..security import require_role

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_role("admin"))])

SALE_STATUSES = ("placed", "confirmed", "shipped", "delivered")     # cancelled and pending_payment are not sales
FLOW = ("placed", "confirmed", "shipped", "delivered")
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ---------- small helpers ----------
class StatusIn(BaseModel):
    status: str


class RejectIn(BaseModel):
    reason: str


class CancelIn(BaseModel):
    reason: Optional[str] = None


def pages(total: int, limit: int) -> int:
    return max(1, -(-total // limit))


def day_label(d) -> str:
    return d.strftime("%a")


def order_row(o: Order) -> dict:
    return {"id": o.id, "order_number": o.order_number, "customer": o.customer.name, "seller": o.seller.shop_name,
            "items": sum(i.quantity for i in o.items), "total": float(o.total), "payment_method": o.payment_method,
            "status": o.status, "placed_at": o.placed_at.isoformat()}


def sales_rows(db: Session, since: datetime):
    return (db.query(Order.placed_at, Order.total)
            .filter(Order.status.in_(SALE_STATUSES), Order.placed_at >= since).all())


def daily_series(rows, days: int) -> list:
    today = datetime.utcnow().date()
    buckets = {today - timedelta(days=i): 0.0 for i in range(days - 1, -1, -1)}
    for placed, total in rows:
        if placed.date() in buckets:
            buckets[placed.date()] += float(total)
    return [{"label": day_label(d) if days <= 7 else d.strftime("%d %b"), "value": round(v, 2)} for d, v in buckets.items()]


def monthly_series(rows) -> list:
    totals = [0.0] * 12
    for placed, total in rows:
        totals[placed.month - 1] += float(total)
    return [{"label": MONTHS[i], "value": round(totals[i], 2)} for i in range(12)]


def get_seller(db: Session, seller_id: int) -> Seller:
    seller = db.get(Seller, seller_id)
    if seller is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seller not found.")
    return seller


def get_order(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.id == order_id, Order.status != "pending_payment").first()
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found.")
    return order


# ---------- dashboard ----------
@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    sales = db.query(func.coalesce(func.sum(Order.total), 0)).filter(Order.status.in_(SALE_STATUSES)).scalar()
    pending = db.query(Seller).filter(Seller.status == "pending").order_by(Seller.id)
    since = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=6)
    latest = (db.query(Order).filter(Order.status != "pending_payment").order_by(Order.id.desc()).limit(5).all())
    return {
        "totals": {
            "users": db.query(func.count(User.id)).filter(User.role == "customer").scalar(),
            "sellers": db.query(func.count(Seller.id)).filter(Seller.status == "approved").scalar(),
            "orders": db.query(func.count(Order.id)).filter(Order.status != "pending_payment").scalar(),
            "sales": float(sales),
        },
        "pending_count": pending.count(),
        "pending_sellers": [{"id": s.id, "owner": s.user.name, "shop_name": s.shop_name,
                             "applied_at": s.created_at.isoformat()} for s in pending.limit(3).all()],
        "sales_by_day": daily_series(sales_rows(db, since), 7),
        "latest_orders": [order_row(o) for o in latest],
    }


# ---------- users (customers) ----------
@router.get("/users")
def list_users(user_status: str = Query("all", alias="status"), q: Optional[str] = None,
               page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    counts = (db.query(Order.customer_id.label("cid"), func.count(Order.id).label("n"))
              .filter(Order.status != "pending_payment").group_by(Order.customer_id).subquery())
    query = (db.query(User, func.coalesce(counts.c.n, 0)).outerjoin(counts, counts.c.cid == User.id)
             .filter(User.role == "customer"))
    if user_status in ("active", "blocked"):
        query = query.filter(User.status == user_status)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(User.name.ilike(like), User.email.ilike(like), User.phone.ilike(like)))
    total = query.count()
    rows = query.order_by(User.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "pages": pages(total, limit),
            "items": [{"id": u.id, "name": u.name, "email": u.email, "joined": u.created_at.isoformat(),
                       "orders": int(n), "status": u.status} for u, n in rows]}


@router.patch("/users/{user_id}/status")
def set_user_status(user_id: int, body: StatusIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.role == "customer").first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer not found.")
    if body.status not in ("active", "blocked"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Status must be active or blocked.")
    user.status = body.status
    db.commit()
    return {"id": user.id, "status": user.status}


# ---------- sellers ----------
@router.get("/sellers")
def list_sellers(seller_status: str = Query("pending", alias="status"), q: Optional[str] = None,
                 page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    query = db.query(Seller).join(User, Seller.user_id == User.id)
    if seller_status in ("pending", "approved", "blocked", "rejected"):
        query = query.filter(Seller.status == seller_status)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(Seller.shop_name.ilike(like), User.name.ilike(like), User.email.ilike(like)))
    total = query.count()
    rows = query.order_by(Seller.id.desc()).offset((page - 1) * limit).limit(limit).all()
    counts = dict(db.query(Seller.status, func.count(Seller.id)).group_by(Seller.status).all())
    return {
        "total": total, "page": page, "pages": pages(total, limit),
        "counts": {k: int(counts.get(k, 0)) for k in ("pending", "approved", "blocked", "rejected")},
        "items": [{"id": s.id, "owner": s.user.name, "shop_name": s.shop_name, "applied_at": s.created_at.isoformat(),
                   "products": db.query(func.count(Product.id)).filter(Product.seller_id == s.id).scalar(),
                   "status": s.status} for s in rows],
    }


@router.get("/sellers/{seller_id}")
def seller_detail(seller_id: int, db: Session = Depends(get_db)):
    s = get_seller(db, seller_id)
    return {
        "id": s.id, "status": s.status, "reject_reason": s.reject_reason,
        "owner": {"name": s.user.name, "email": s.user.email, "phone": s.user.phone, "account_status": s.user.status},
        "shop": {"name": s.shop_name, "description": s.description, "category": s.category,
                 "pickup_address": ", ".join(x for x in [s.pickup_address, s.city, s.pincode] if x)},
        "documents": [{"id": d.id, "kind": d.kind, "name": d.original_name} for d in s.documents],
        "applied_at": s.created_at.isoformat(),
        "approved_at": s.approved_at.isoformat() if s.approved_at else None,
        "products": db.query(func.count(Product.id)).filter(Product.seller_id == s.id).scalar(),
    }


def document_path(doc: SellerDocument) -> Optional[str]:
    """Finds the saved file. Set DOCUMENTS_DIR in .env to the folder your seller module saves documents in."""
    if os.path.isabs(doc.file_path):
        return doc.file_path if os.path.isfile(doc.file_path) else None
    for base in (os.getenv("DOCUMENTS_DIR", "private"), settings.UPLOAD_DIR, "."):
        path = os.path.join(base, doc.file_path)
        if os.path.isfile(path):
            return path
    return None


@router.get("/sellers/{seller_id}/documents/{document_id}")
def seller_document(seller_id: int, document_id: int, db: Session = Depends(get_db)):
    doc = db.query(SellerDocument).filter(SellerDocument.id == document_id, SellerDocument.seller_id == seller_id).first()
    path = document_path(doc) if doc else None
    if path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found.")
    return FileResponse(path, filename=doc.original_name or os.path.basename(path), content_disposition_type="inline")


@router.patch("/sellers/{seller_id}/approve")
def approve_seller(seller_id: int, db: Session = Depends(get_db)):
    s = get_seller(db, seller_id)
    if s.status not in ("pending", "rejected"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"This seller is already {s.status}.")
    s.status, s.reject_reason, s.approved_at = "approved", None, datetime.utcnow()
    db.commit()
    send_email(s.user.email, "Your UrbanCart seller application is approved",
               f"Hi {s.user.name},\n\nYour shop \"{s.shop_name}\" is approved. Log in as a seller to add your products.\n\nUrbanCart")
    return {"id": s.id, "status": s.status}


@router.patch("/sellers/{seller_id}/reject")
def reject_seller(seller_id: int, body: RejectIn, db: Session = Depends(get_db)):
    s = get_seller(db, seller_id)
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A reason is required to reject an application.")
    if s.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a pending application can be rejected. Use block for an approved seller.")
    s.status, s.reject_reason = "rejected", reason[:500]
    db.commit()
    send_email(s.user.email, "Your UrbanCart seller application was not approved",
               f"Hi {s.user.name},\n\nYour application for \"{s.shop_name}\" was not approved.\n\nReason: {s.reject_reason}\n\n"
               "Log in to correct your application and apply again.\n\nUrbanCart")
    return {"id": s.id, "status": s.status}


@router.patch("/sellers/{seller_id}/status")
def block_or_unblock_seller(seller_id: int, body: StatusIn, db: Session = Depends(get_db)):
    """status 'blocked' blocks an approved seller (products are hidden). 'approved' unblocks."""
    s = get_seller(db, seller_id)
    if body.status == "blocked" and s.status == "approved":
        s.status = "blocked"
    elif body.status == "approved" and s.status == "blocked":
        s.status = "approved"
    else:
        raise HTTPException(status.HTTP_409_CONFLICT, "That change is not possible for this seller.")
    db.commit()
    return {"id": s.id, "status": s.status}


# ---------- orders ----------
@router.get("/orders")
def list_orders(order_status: str = Query("all", alias="status"), q: Optional[str] = None,
                page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    query = (db.query(Order).join(User, Order.customer_id == User.id).filter(Order.status != "pending_payment"))
    if order_status in FLOW + ("cancelled",):
        query = query.filter(Order.status == order_status)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(Order.order_number.ilike(like), User.name.ilike(like)))
    total = query.count()
    rows = query.order_by(Order.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "pages": pages(total, limit), "items": [order_row(o) for o in rows]}


@router.get("/orders/{order_id}")
def order_detail(order_id: int, db: Session = Depends(get_db)):
    o = get_order(db, order_id)
    returns = db.query(ReturnRequest).filter(ReturnRequest.order_id == o.id).all()
    return {
        **order_row(o),
        "subtotal": float(o.subtotal), "tax": float(o.tax), "delivery_charge": float(o.delivery_charge),
        "payment_status": o.payment_status, "cancel_reason": o.cancel_reason,
        "customer_detail": {"name": o.ship_name, "phone": o.ship_phone,
                            "address": f"{o.ship_street}, {o.ship_city}, {o.ship_state} {o.ship_pincode}"},
        "seller_detail": {"shop_name": o.seller.shop_name, "owner": o.seller.user.name},
        "items": [{"name": i.name, "quantity": i.quantity, "price": float(i.price),
                   "line_total": float(i.price * i.quantity)} for i in o.items],
        "history": [{"status": h.status, "at": h.changed_at.isoformat()} for h in o.history],
        "returns": [{"id": r.id, "item": r.order_item.name, "quantity": r.quantity, "status": r.status,
                     "reason": r.reason} for r in returns],
    }


@router.patch("/orders/{order_id}/status")
def change_order_status(order_id: int, body: StatusIn, admin: User = Depends(require_role("admin")),
                        db: Session = Depends(get_db)):
    """Correct a status. Normal moves are done by the seller; this is for stuck or wrong orders."""
    o = get_order(db, order_id)
    if body.status not in FLOW:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose placed, confirmed, shipped or delivered. Use Cancel order to cancel.")
    if o.status == "cancelled":
        raise HTTPException(status.HTTP_409_CONFLICT, "A cancelled order cannot be changed.")
    if o.status == body.status:
        raise HTTPException(status.HTTP_409_CONFLICT, f"The order is already {o.status}.")
    o.status = body.status
    o.delivered_at = datetime.utcnow() if body.status == "delivered" else None
    db.add(OrderStatusHistory(order_id=o.id, status=body.status, changed_by=admin.id))
    db.commit()
    send_email(o.customer.email, f"Your order {o.order_number} is now {body.status}",
               f"Hi {o.customer.name},\n\nYour order {o.order_number} is now {body.status}.\n\nUrbanCart")
    return {"id": o.id, "status": o.status}


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: int, body: CancelIn, admin: User = Depends(require_role("admin")),
                 db: Session = Depends(get_db)):
    """Cancels a stuck or disputed order and puts the stock back. A delivered order uses the return flow."""
    o = get_order(db, order_id)
    if o.status == "cancelled":
        raise HTTPException(status.HTTP_409_CONFLICT, "This order is already cancelled.")
    if o.status == "delivered":
        raise HTTPException(status.HTTP_409_CONFLICT, "A delivered order cannot be cancelled. Use the return flow.")
    for item in o.items:
        product = db.get(Product, item.product_id)
        if product is not None:
            product.stock += item.quantity
    o.status = "cancelled"
    o.cancel_reason = (body.reason or "Cancelled by admin")[:255]
    db.add(OrderStatusHistory(order_id=o.id, status="cancelled", changed_by=admin.id))
    db.commit()
    for email, name in ((o.customer.email, o.customer.name), (o.seller.user.email, o.seller.user.name)):
        send_email(email, f"Order {o.order_number} was cancelled",
                   f"Hi {name},\n\nOrder {o.order_number} was cancelled by UrbanCart.\nReason: {o.cancel_reason}\nNo payment is due.\n\nUrbanCart")
    return {"id": o.id, "status": o.status}


# ---------- returns and refunds ----------
RETURN_STATUSES = ("requested", "approved", "rejected", "shipped_back", "received", "refund_owed", "refunded")


@router.get("/returns")
def list_returns(return_status: str = Query("all", alias="status"), page: int = Query(1, ge=1),
                 limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    query = db.query(ReturnRequest)
    if return_status in RETURN_STATUSES:
        query = query.filter(ReturnRequest.status == return_status)
    total = query.count()
    rows = query.order_by(ReturnRequest.id.desc()).offset((page - 1) * limit).limit(limit).all()
    counts = dict(db.query(ReturnRequest.status, func.count(ReturnRequest.id)).group_by(ReturnRequest.status).all())
    items = []
    for r in rows:
        order = db.get(Order, r.order_id)
        items.append({"id": r.id, "order_id": order.id, "order_number": order.order_number, "item": r.order_item.name,
                      "quantity": r.quantity, "customer": order.customer.name, "seller": order.seller.shop_name,
                      "payment_method": order.payment_method, "reason": r.reason, "status": r.status,
                      "refund_amount": float(r.refund_amount) if r.refund_amount is not None else None,
                      "requested_at": r.requested_at.isoformat()})
    return {"total": total, "page": page, "pages": pages(total, limit),
            "counts": {k: int(counts.get(k, 0)) for k in RETURN_STATUSES}, "items": items}


@router.patch("/returns/{return_id}/refund-paid")
def mark_refund_paid(return_id: int, db: Session = Depends(get_db)):
    """A Cash on Delivery refund is 'owed' until the admin has paid it outside the site."""
    r = db.get(ReturnRequest, return_id)
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Return not found.")
    if r.status != "refund_owed":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a refund that is owed can be marked as paid.")
    r.status, r.refunded_at = "refunded", datetime.utcnow()
    db.commit()
    order = db.get(Order, r.order_id)
    send_email(order.customer.email, "Your UrbanCart refund is done",
               f"Hi {order.customer.name},\n\nYour refund for {r.order_item.name} (order {order.order_number}) has been paid.\n\nUrbanCart")
    return {"id": r.id, "status": r.status}


# ---------- reports ----------
@router.get("/reports")
def reports(period: str = Query("7d", pattern="^(7d|30d|year)$"), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    if period == "year":
        since = datetime(now.year, 1, 1)
    else:
        days = 7 if period == "7d" else 30
        since = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    rows = sales_rows(db, since)
    in_period = db.query(Order).filter(Order.placed_at >= since, Order.status != "pending_payment")

    top_sellers = (db.query(Seller.shop_name, func.count(Order.id), func.coalesce(func.sum(Order.total), 0))
                   .join(Order, Order.seller_id == Seller.id)
                   .filter(Order.status.in_(SALE_STATUSES), Order.placed_at >= since)
                   .group_by(Seller.id).order_by(func.sum(Order.total).desc()).limit(5).all())

    cat_rows = (db.query(Category, func.sum(OrderItem.price * OrderItem.quantity))
                .select_from(OrderItem).join(Order, Order.id == OrderItem.order_id)
                .join(Product, Product.id == OrderItem.product_id).join(Category, Category.id == Product.category_id)
                .filter(Order.status.in_(SALE_STATUSES), Order.placed_at >= since).group_by(Category.id).all())
    by_parent = {}
    for cat, amount in cat_rows:
        parent = db.get(Category, cat.parent_id) if cat.parent_id else cat
        by_parent[parent.name] = by_parent.get(parent.name, 0.0) + float(amount or 0)

    return {
        "period": period,
        "kpis": {"sales": round(sum(float(t) for _, t in rows), 2), "orders": len(rows),
                 "new_users": db.query(func.count(User.id)).filter(User.role == "customer", User.created_at >= since).scalar(),
                 "cancelled": in_period.filter(Order.status == "cancelled").count()},
        "series": monthly_series(rows) if period == "year" else daily_series(rows, 7 if period == "7d" else 30),
        "top_sellers": [{"shop_name": n, "orders": int(c), "sales": float(s)} for n, c, s in top_sellers],
        "top_categories": [{"name": k, "sales": round(v, 2)} for k, v in sorted(by_parent.items(), key=lambda x: -x[1])[:5]],
    }
