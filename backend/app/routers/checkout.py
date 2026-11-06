"""Checkout: validate the cart, place orders, test payment, invoice download."""
import re
import secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Address, Order, Payment, User
from ..schemas import ValidateIn, PlaceOrderIn, TestPayIn
from ..security import require_role
from ..services import (cart_lines, group_totals, create_orders, finalize_orders, new_ref,
                        order_summary, invoice_html, StockError)

router = APIRouter(tags=["Checkout and payment"])


def problems_of(lines: list) -> list:
    return [{"item_id": l["id"], "product_id": l["product_id"], "name": l["name"], **l["problem"]}
            for l in lines if l["problem"]]


def floats(group: dict) -> dict:
    return {k: (float(v) if k in ("subtotal", "tax", "delivery", "total") else v) for k, v in group.items()}


@router.post("/checkout/validate")
def validate_checkout(body: ValidateIn, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    """Checks stock and totals before the customer places the order."""
    lines = cart_lines(db, user)
    problems = [] if lines else [{"code": "empty", "message": "Your cart is empty."}]
    problems += problems_of(lines)
    address_ok = None
    if body.address_id is not None:
        address_ok = db.query(Address).filter(Address.id == body.address_id, Address.user_id == user.id).first() is not None
    groups, totals = group_totals(lines)
    return {"ok": not problems, "problems": problems, "address_ok": address_ok,
            "groups": [floats(g) for g in groups], "totals": {k: float(v) for k, v in totals.items()}}


@router.post("/orders", status_code=status.HTTP_201_CREATED)
def place_order(body: PlaceOrderIn, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    """One order is created for each seller in the cart.
    Cash on Delivery: placed at once. Online: waits for POST /payments/test-pay."""
    address = db.query(Address).filter(Address.id == body.address_id, Address.user_id == user.id).first()
    if address is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a delivery address.")
    # Unpaid online orders from an earlier try never took any stock, so they are simply dropped
    for old in db.query(Order).filter(Order.customer_id == user.id, Order.status == "pending_payment").all():
        db.delete(old)
    db.flush()
    lines = cart_lines(db, user)
    if not lines:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your cart is empty.")
    problems = problems_of(lines)
    if problems:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"message": "Some items are no longer available.", "problems": problems})
    ref = new_ref(db)
    orders = create_orders(db, user, address, body.payment_method, lines, ref)
    if body.payment_method == "cod":
        try:
            finalize_orders(db, user, orders, paid=False)
        except StockError as exc:
            db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, detail={"message": str(exc), "problems": []})
    else:
        db.commit()
    return {"ref": ref, "payment_method": body.payment_method, "address_id": address.id,
            "next": "done" if body.payment_method == "cod" else "pay",
            "total": float(sum(o.total for o in orders)), "orders": [order_summary(o) for o in orders]}


def check_payment_details(body: TestPayIn) -> bool:
    """Checks the test details. Returns True when the test payment should FAIL.
    Test rules: a card number ending in 0000 fails; a UPI id containing 'fail' fails; everything else succeeds."""
    if body.method == "card":
        number = re.sub(r"\s", "", body.card_number or "")
        if not re.fullmatch(r"\d{12,19}", number):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter a valid card number.")
        if not (body.name or "").strip():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter the name on the card.")
        m = re.fullmatch(r"(\d{2})/(\d{2})", (body.expiry or "").strip())
        if not m or not 1 <= int(m.group(1)) <= 12:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter the expiry as MM/YY.")
        now = datetime.utcnow()
        if (2000 + int(m.group(2)), int(m.group(1))) < (now.year, now.month):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "This card has expired.")
        if not re.fullmatch(r"\d{3,4}", (body.cvv or "").strip()):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter the 3 or 4 digit CVV.")
        return number.endswith("0000")
    upi = (body.upi_id or "").strip()
    if not re.fullmatch(r"[\w.\-]{2,}@\w{2,}", upi):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter a valid UPI id, for example name@bank.")
    return "fail" in upi.lower()


@router.post("/payments/test-pay")
def test_pay(body: TestPayIn, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    """Simulated online payment. No real money moves."""
    orders = (db.query(Order).filter(Order.order_number.like(body.ref + "-%"), Order.customer_id == user.id)
              .order_by(Order.id).all())
    if not orders:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No payment is waiting for this order.")
    pending = [o for o in orders if o.status == "pending_payment"]
    total = float(sum(o.total for o in orders))
    if not pending:                                   # already paid, for example a double click
        return {"status": "success", "message": "This order is already paid.", "total": total,
                "orders": [order_summary(o) for o in orders]}
    should_fail = check_payment_details(body)
    if should_fail:
        for o in pending:
            o.payment_status = "failed"
            db.add(Payment(order_id=o.id, method="online", amount=o.total, status="failed", reference="TEST-DECLINED"))
        db.commit()
        return {"status": "failed", "message": "The test payment failed. No money was charged.", "total": total,
                "orders": [order_summary(o) for o in pending]}
    try:
        finalize_orders(db, user, pending, paid=True, reference="TEST-" + secrets.token_hex(4).upper())
    except StockError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"message": str(exc), "problems": []})
    return {"status": "success", "message": "Payment successful.", "total": total,
            "orders": [order_summary(o) for o in orders]}


@router.get("/orders/{order_id}/invoice")
def download_invoice(order_id: int, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    order = (db.query(Order).filter(Order.id == order_id, Order.customer_id == user.id,
                                    Order.status != "pending_payment").first())
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found.")
    return HTMLResponse(invoice_html(order),
                        headers={"Content-Disposition": f'attachment; filename="invoice-{order.order_number}.html"'})
