"""Cart pricing, stock checks and order creation. Used by the cart, wishlist and checkout routers.

Rules (from the BRD and the decisions we made):
- One order per seller. A cart with items from two sellers becomes two orders.
- Tax is a fixed percentage of the order subtotal. Delivery is charged per order and is free
  when that order's subtotal reaches the free-delivery amount.
- Cash on Delivery: the order is placed at once and the stock is reduced.
- Online (test) payment: orders are created as 'pending_payment' without touching the stock.
  The stock is re-checked and reduced only when the test payment succeeds.
"""
import html
import secrets
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
from .config import settings
from .emailer import send_email
from .models import (CartItem, Product, Order, OrderItem, OrderStatusHistory, Payment, User)

TWO = Decimal("0.01")
MAX_PER_ITEM = 10


class StockError(Exception):
    """Raised when an item sold out while the customer was checking out."""


def D(value) -> Decimal:
    return Decimal(str(value))


def q(value) -> Decimal:
    return D(value).quantize(TWO, ROUND_HALF_UP)


def stock_status(stock: int) -> str:
    if stock <= 0:
        return "out_of_stock"
    return "low_stock" if stock <= settings.LOW_STOCK_LIMIT else "in_stock"


def buy_problem(product: Product, quantity: int = 1):
    """None when the product can be bought in this quantity, otherwise a reason."""
    seller = product.seller
    if product.status != "active" or seller.status != "approved" or seller.user.status != "active":
        return {"code": "no_longer_available", "message": "This product is no longer available."}
    if product.stock <= 0:
        return {"code": "out_of_stock", "message": "This product is out of stock."}
    if quantity > product.stock:
        return {"code": "low_stock", "message": f"Only {product.stock} left.", "available": product.stock}
    return None


def max_quantity(product: Product) -> int:
    return max(0, min(product.stock, MAX_PER_ITEM))


# ---------- cart ----------
def add_item(db: Session, user: User, product: Product, quantity: int) -> str:
    """Adds to the cart (or increases the quantity). Raises ValueError with a message to show."""
    problem = buy_problem(product, 1)
    if problem:
        raise ValueError(problem["message"])
    limit = max_quantity(product)
    item = db.query(CartItem).filter(CartItem.user_id == user.id, CartItem.product_id == product.id).first()
    current = item.quantity if item else 0
    if current >= limit:
        raise ValueError(f"You already have {current} in your cart. Only {limit} can be bought at a time.")
    new_quantity = min(current + quantity, limit)
    if item:
        item.quantity = new_quantity
    else:
        db.add(CartItem(user_id=user.id, product_id=product.id, quantity=new_quantity))
    db.commit()
    if current + quantity > limit:
        return f"Added. Only {limit} can be bought at a time."
    return "Added to your cart."


def cart_lines(db: Session, user: User) -> list:
    items = db.query(CartItem).filter(CartItem.user_id == user.id).order_by(CartItem.id).all()
    lines = []
    for item in items:
        p = item.product
        lines.append({
            "id": item.id, "product_id": p.id, "name": p.name, "price": q(p.price),
            "quantity": item.quantity, "line_total": q(p.price * item.quantity),
            "stock": p.stock, "stock_status": stock_status(p.stock),
            "image": p.images[0].file_path if p.images else None,
            "seller_id": p.seller_id, "seller_name": p.seller.shop_name,
            "problem": buy_problem(p, item.quantity),
        })
    return lines


def group_totals(lines: list):
    """Totals for the items that can be bought, grouped by seller (one group = one order)."""
    groups = {}
    for line in lines:
        if line["problem"]:
            continue
        g = groups.setdefault(line["seller_id"], {"seller_id": line["seller_id"], "seller_name": line["seller_name"],
                                                  "subtotal": Decimal("0"), "item_count": 0})
        g["subtotal"] += line["line_total"]
        g["item_count"] += line["quantity"]
    out = []
    totals = {"subtotal": Decimal("0"), "tax": Decimal("0"), "delivery": Decimal("0"), "total": Decimal("0")}
    for g in groups.values():
        g["subtotal"] = q(g["subtotal"])
        g["tax"] = q(g["subtotal"] * D(settings.TAX_PERCENT) / 100)
        g["delivery"] = q(0) if g["subtotal"] >= D(settings.FREE_DELIVERY_ABOVE) else q(settings.DELIVERY_CHARGE)
        g["total"] = q(g["subtotal"] + g["tax"] + g["delivery"])
        for key in totals:
            totals[key] += g[key]
        out.append(g)
    return out, {k: q(v) for k, v in totals.items()}


# ---------- orders ----------
def new_ref(db: Session) -> str:
    while True:
        ref = "UC" + secrets.token_hex(3).upper()
        if not db.query(Order.id).filter(Order.order_number.like(ref + "-%")).first():
            return ref


def create_orders(db: Session, user: User, address, method: str, lines: list, ref: str) -> list:
    groups, _ = group_totals(lines)
    orders = []
    for index, g in enumerate(groups, start=1):
        order = Order(
            order_number=f"{ref}-{index}", customer_id=user.id, seller_id=g["seller_id"],
            ship_name=address.full_name, ship_phone=address.phone, ship_street=address.street,
            ship_city=address.city, ship_state=address.state, ship_pincode=address.pincode,
            payment_method=method, payment_status="pending",
            status="placed" if method == "cod" else "pending_payment",
            subtotal=g["subtotal"], tax=g["tax"], delivery_charge=g["delivery"], total=g["total"],
        )
        for line in lines:
            if line["seller_id"] == g["seller_id"] and not line["problem"]:
                order.items.append(OrderItem(product_id=line["product_id"], name=line["name"],
                                             price=line["price"], quantity=line["quantity"]))
        db.add(order)
        orders.append(order)
    db.flush()
    return orders


def finalize_orders(db: Session, user: User, orders: list, paid: bool, reference: str = None):
    """Re-checks the stock, reduces it, marks the orders Placed, records the payment, empties the cart."""
    ids = {item.product_id for o in orders for item in o.items}
    products = {p.id: p for p in db.query(Product).filter(Product.id.in_(ids)).with_for_update().all()}
    for o in orders:
        for item in o.items:
            if products[item.product_id].stock < item.quantity:
                raise StockError(f"{item.name} sold out while you were checking out.")
    for o in orders:
        for item in o.items:
            products[item.product_id].stock -= item.quantity
        o.status = "placed"
        o.payment_status = "paid" if paid else "pending"
        db.add(OrderStatusHistory(order_id=o.id, status="placed", changed_by=user.id))
        db.add(Payment(order_id=o.id, method=o.payment_method, amount=o.total,
                       status="success" if paid else "pending", reference=reference))
    db.query(CartItem).filter(CartItem.user_id == user.id).delete()
    db.commit()
    send_order_email(user, orders)


def order_summary(order: Order) -> dict:
    return {"id": order.id, "order_number": order.order_number, "seller_name": order.seller.shop_name,
            "status": order.status, "payment_method": order.payment_method, "payment_status": order.payment_status,
            "total": float(order.total)}


def send_order_email(user: User, orders: list):
    lines = "\n".join(f"  {o.order_number}  sold by {o.seller.shop_name}  Rs. {o.total}" for o in orders)
    method = "Cash on Delivery: pay when it arrives." if orders[0].payment_method == "cod" else "Paid online (test mode)."
    send_email(user.email, f"Your UrbanCart order is placed ({orders[0].order_number.split('-')[0]})",
               f"Hi {user.name},\n\nThank you for your order.\n\n{lines}\n\n{method}\n"
               f"You can download the invoice from the order page.\n\nUrbanCart")


# ---------- invoice ----------
def invoice_html(order: Order) -> str:
    e = html.escape
    rows = "".join(
        f"<tr><td>{e(i.name)}</td><td class='r'>{i.quantity}</td><td class='r'>{i.price}</td>"
        f"<td class='r'>{q(i.price * i.quantity)}</td></tr>" for i in order.items)
    method = "Cash on Delivery" if order.payment_method == "cod" else "Online payment (test mode)"
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>Invoice {e(order.order_number)}</title>
<style>body{{font-family:Arial,sans-serif;color:#26211A;max-width:760px;margin:30px auto;padding:0 20px}}
h1{{margin:0}} table{{width:100%;border-collapse:collapse;margin-top:20px}} th,td{{border-bottom:1px solid #ddd;padding:8px;text-align:left}}
.r{{text-align:right}} .tot td{{border:0}} .b{{font-weight:bold}} .muted{{color:#5E5546;font-size:14px}}</style></head><body>
<h1>UrbanCart</h1><p class="muted">Tax invoice</p>
<p><b>Invoice for order {e(order.order_number)}</b><br>Date: {order.placed_at:%d %b %Y}<br>Sold by: {e(order.seller.shop_name)}</p>
<p><b>Deliver to</b><br>{e(order.ship_name)}, {e(order.ship_phone)}<br>{e(order.ship_street)}, {e(order.ship_city)}, {e(order.ship_state)} {e(order.ship_pincode)}</p>
<table><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr>{rows}
<tr class="tot"><td colspan="3" class="r">Items subtotal</td><td class="r">{order.subtotal}</td></tr>
<tr class="tot"><td colspan="3" class="r">Tax ({settings.TAX_PERCENT:g}%)</td><td class="r">{order.tax}</td></tr>
<tr class="tot"><td colspan="3" class="r">Delivery</td><td class="r">{order.delivery_charge}</td></tr>
<tr class="tot b"><td colspan="3" class="r">Total (Rs.)</td><td class="r">{order.total}</td></tr></table>
<p class="muted">Payment: {method}. Status: {e(order.payment_status)}.</p></body></html>"""
