"""Optional. Fills the database with sample sellers, orders and a refund so every admin page has data.
Run once after seed.py:   python seed_admin_demo.py      (safe to run again)"""
from datetime import datetime, timedelta
from app.database import SessionLocal
from app import models
from app.security import hash_password


def main():
    db = SessionLocal()
    if db.query(models.Order).filter(models.Order.order_number.like("UCDEMO-%")).first():
        print("Admin demo data is already there.")
        return
    # three applications: two pending, one rejected
    for i, (shop, status, reason) in enumerate([("Green Leaf Store", "pending", None), ("Tech Corner", "pending", None),
                                                 ("Old Books Hub", "rejected", "ID proof is not readable")], start=1):
        u = models.User(name=f"Applicant {i}", email=f"applicant{i}@urbancart.local", phone=f"90000020{i}",
                        password_hash=hash_password("Seller@123"), role="seller")
        db.add(u); db.flush()
        db.add(models.Seller(user_id=u.id, shop_name=shop, description="Sample application", category="General",
                             pickup_address="5 Brigade Road", city="Bengaluru", pincode="560001",
                             status=status, reject_reason=reason))
    customer = db.query(models.User).filter_by(email="customer@urbancart.local").first()
    products = db.query(models.Product).filter(models.Product.stock > 0).limit(6).all()
    statuses = ["placed", "confirmed", "shipped", "delivered", "delivered", "cancelled"]
    orders = []
    for n, (p, st) in enumerate(zip(products, statuses), start=1):
        total = float(p.price) * 1.05
        o = models.Order(order_number=f"UCDEMO-{n}", customer_id=customer.id, seller_id=p.seller_id,
                         payment_method="cod" if n % 2 else "online", payment_status="pending" if n % 2 else "paid",
                         status=st, subtotal=p.price, tax=round(float(p.price) * 0.05, 2), delivery_charge=0, total=round(total, 2),
                         ship_name=customer.name, ship_phone=customer.phone, ship_street="1 MG Road",
                         ship_city="Bengaluru", ship_state="Karnataka", ship_pincode="560001",
                         placed_at=datetime.utcnow() - timedelta(days=6 - n))
        o.items.append(models.OrderItem(product_id=p.id, name=p.name, price=p.price, quantity=1))
        db.add(o); orders.append(o)
    db.flush()
    # one Cash on Delivery refund that is owed, one refund that is already done
    for o, status in ((orders[3], "refund_owed"), (orders[4], "refunded")):
        item = o.items[0]
        db.add(models.ReturnRequest(order_item_id=item.id, order_id=o.id, customer_id=o.customer_id, seller_id=o.seller_id,
                                    quantity=1, reason="Not as described", status=status, refund_amount=o.total))
    db.commit()
    print("Done: 3 sample applications, 6 orders, 2 returns.")


if __name__ == "__main__":
    main()
