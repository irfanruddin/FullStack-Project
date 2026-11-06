"""Customer order history, tracking, cancellation and return/refund status.

Copy this router into backend/app/routers/orders.py in the UrbanCart project.
It reuses the existing Stage 3 models and authentication dependencies.
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..database import get_db
from ..models import Order, OrderItem, OrderStatusHistory, Product, ReturnRequest, User
from ..security import require_role

router = APIRouter(tags=["Customer orders"])


class CancelOrderIn(BaseModel):
    reason: str = Field(min_length=3, max_length=255)


class ReturnRequestIn(BaseModel):
    order_item_id: int
    reason: str = Field(min_length=3, max_length=150)
    comment: str | None = Field(default=None, max_length=2000)


def _customer_order(db: Session, order_id: int, customer_id: int, *, lock: bool = False) -> Order:
    query = db.query(Order).options(joinedload(Order.items), joinedload(Order.seller)).filter(
        Order.id == order_id,
        Order.customer_id == customer_id,
        Order.status != "pending_payment",
    )
    if lock:
        query = query.with_for_update()
    order = query.first()
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found.")
    return order


def _refund_status(db: Session, order: Order) -> str:
    """Expose refund progress without claiming that money was actually transferred."""
    requests = db.query(ReturnRequest).filter(ReturnRequest.order_id == order.id).all()
    if requests:
        states = {r.status for r in requests}
        if "refunded" in states:
            return "refunded"
        if "refund_owed" in states or "received" in states:
            return "refund_pending"
        if "rejected" in states:
            return "return_rejected"
        return "return_in_progress"
    if order.status == "cancelled" and order.payment_method == "online" and order.payment_status == "paid":
        return "refund_pending"
    return "not_applicable"


def _order_payload(db: Session, order: Order) -> dict:
    history = db.query(OrderStatusHistory).filter(
        OrderStatusHistory.order_id == order.id
    ).order_by(OrderStatusHistory.changed_at.asc(), OrderStatusHistory.id.asc()).all()
    returns = db.query(ReturnRequest).filter(ReturnRequest.order_id == order.id).all()
    return {
        "id": order.id,
        "order_number": order.order_number,
        "seller_name": order.seller.shop_name if order.seller else None,
        "status": order.status,
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "refund_status": _refund_status(db, order),
        "subtotal": float(order.subtotal or 0),
        "tax": float(order.tax or 0),
        "delivery_charge": float(order.delivery_charge or 0),
        "total": float(order.total or 0),
        "placed_at": order.placed_at.isoformat() if order.placed_at else None,
        "delivered_at": order.delivered_at.isoformat() if order.delivered_at else None,
        "cancel_reason": order.cancel_reason,
        "items": [{
            "id": item.id,
            "product_id": item.product_id,
            "name": item.name,
            "price": float(item.price),
            "quantity": item.quantity,
        } for item in order.items],
        "tracking": [{
            "status": entry.status,
            "changed_at": entry.changed_at.isoformat() if entry.changed_at else None,
        } for entry in history],
        "returns": [{
            "id": r.id,
            "order_item_id": r.order_item_id,
            "quantity": r.quantity,
            "reason": r.reason,
            "comment": r.comment,
            "status": r.status,
            "reject_reason": r.reject_reason,
            "refund_amount": float(r.refund_amount) if r.refund_amount is not None else None,
            "requested_at": r.requested_at.isoformat() if r.requested_at else None,
        } for r in returns],
    }


@router.get("/orders")
def customer_order_history(
    user: User = Depends(require_role("customer")),
    db: Session = Depends(get_db),
):
    """Return only this customer's completed/placed order records, newest first."""
    orders = (db.query(Order).options(joinedload(Order.items), joinedload(Order.seller))
              .filter(Order.customer_id == user.id, Order.status != "pending_payment")
              .order_by(Order.placed_at.desc(), Order.id.desc()).all())
    return [_order_payload(db, order) for order in orders]


@router.get("/orders/{order_id}")
def customer_order_detail(
    order_id: int,
    user: User = Depends(require_role("customer")),
    db: Session = Depends(get_db),
):
    order = _customer_order(db, order_id, user.id)
    return _order_payload(db, order)


@router.post("/orders/{order_id}/cancel")
def cancel_customer_order(
    order_id: int,
    body: CancelOrderIn,
    user: User = Depends(require_role("customer")),
    db: Session = Depends(get_db),
):
    """Customer cancellation is permitted only before shipment (placed/confirmed)."""
    order = _customer_order(db, order_id, user.id, lock=True)
    if order.status not in ("placed", "confirmed"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This order can no longer be cancelled.")

    # Restore stock exactly once, in the same transaction as the status change.
    product_ids = [item.product_id for item in order.items]
    products = {p.id: p for p in db.query(Product).filter(Product.id.in_(product_ids)).with_for_update().all()}
    for item in order.items:
        product = products.get(item.product_id)
        if product is not None:
            product.stock += item.quantity

    order.status = "cancelled"
    order.cancel_reason = body.reason.strip()
    db.add(OrderStatusHistory(order_id=order.id, status="cancelled", changed_by=user.id))
    db.commit()
    db.refresh(order)
    return {"message": "Order cancelled successfully.", "order": _order_payload(db, order)}


@router.post("/orders/{order_id}/returns", status_code=status.HTTP_201_CREATED)
def request_return(
    order_id: int,
    body: ReturnRequestIn,
    user: User = Depends(require_role("customer")),
    db: Session = Depends(get_db),
):
    """Submit a return request for an item in a delivered order within the configured window."""
    order = _customer_order(db, order_id, user.id)
    if order.status != "delivered" or order.delivered_at is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only delivered orders can be returned.")
    window_days = int(getattr(settings, "RETURN_WINDOW_DAYS", 5))
    if datetime.utcnow() > order.delivered_at + timedelta(days=window_days):
        raise HTTPException(status.HTTP_409_CONFLICT, "The return window for this order has expired.")

    item = db.query(OrderItem).filter(
        OrderItem.id == body.order_item_id,
        OrderItem.order_id == order.id,
    ).first()
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order item not found.")
    existing = db.query(ReturnRequest).filter(ReturnRequest.order_item_id == item.id).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A return request already exists for this item.")

    request = ReturnRequest(
        order_item_id=item.id,
        order_id=order.id,
        customer_id=user.id,
        seller_id=order.seller_id,
        quantity=item.quantity,
        reason=body.reason.strip(),
        comment=body.comment.strip() if body.comment else None,
        status="requested",
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return {
        "message": "Return request submitted.",
        "return": {
            "id": request.id,
            "order_id": request.order_id,
            "order_item_id": request.order_item_id,
            "status": request.status,
            "refund_amount": None,
        },
    }


@router.get("/orders/{order_id}/refund-status")
def customer_refund_status(
    order_id: int,
    user: User = Depends(require_role("customer")),
    db: Session = Depends(get_db),
):
    order = _customer_order(db, order_id, user.id)
    returns = db.query(ReturnRequest).filter(ReturnRequest.order_id == order.id).all()
    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "refund_status": _refund_status(db, order),
        "returns": [{
            "id": r.id,
            "status": r.status,
            "refund_amount": float(r.refund_amount) if r.refund_amount is not None else None,
            "refunded_at": r.refunded_at.isoformat() if r.refunded_at else None,
        } for r in returns],
        "note": "Refund payment/settlement is not performed by this customer module. The status is updated by the seller/admin workflow.",
    }
