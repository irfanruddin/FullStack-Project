"""Run with:  pytest   (temporary SQLite database)"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app import models
from app.security import hash_password
import seed

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Session = sessionmaker(bind=engine)
P = "/api/v1"


def override_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    db = Session()
    for name, subs in seed.CATEGORIES.items():
        parent = models.Category(name=name)
        db.add(parent); db.flush()
        for s in subs:
            db.add(models.Category(name=s, parent_id=parent.id))
    db.commit()
    seed.seed_demo(db)
    db.add(models.User(name="Admin", email="admin@urbancart.local", phone="9000000000",
                       password_hash=hash_password("Admin@123"), role="admin"))
    db.add(models.User(name="Cust", email="customer@urbancart.local", phone="9000000001",
                       password_hash=hash_password("Customer@123"), role="customer"))
    db.commit(); db.close()
    app.dependency_overrides[get_db] = override_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def admin(client):
    r = client.post(f"{P}/auth/admin/login", json={"email": "admin@urbancart.local", "password": "Admin@123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def customer_headers(client):
    r = client.post(f"{P}/auth/login", json={"identifier": "customer@urbancart.local", "password": "Customer@123", "role": "customer"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def make_order(status="placed", qty=2, method="cod"):
    db = Session()
    cust = db.query(models.User).filter_by(email="customer@urbancart.local").first()
    prod = db.query(models.Product).filter_by(name="Cotton kurta").first()
    o = models.Order(order_number="UCTEST-1", customer_id=cust.id, seller_id=prod.seller_id, payment_method=method,
                     status=status, subtotal=1598, tax=80, delivery_charge=0, total=1678,
                     ship_name="Asha", ship_phone="9876543210", ship_street="1 MG Road", ship_city="Bengaluru",
                     ship_state="Karnataka", ship_pincode="560001")
    o.items.append(models.OrderItem(product_id=prod.id, name=prod.name, price=prod.price, quantity=qty))
    db.add(o); db.commit(); oid = o.id; db.close()
    return oid


def make_pending_seller():
    db = Session()
    u = models.User(name="New Seller", email="new@example.com", phone="9000000777",
                    password_hash=hash_password("Seller@123"), role="seller")
    db.add(u); db.flush()
    s = models.Seller(user_id=u.id, shop_name="New Shop", status="pending")
    db.add(s); db.commit(); sid = s.id; db.close()
    return sid


def test_only_admins_get_in(client):
    assert client.get(f"{P}/admin/dashboard").status_code == 401
    assert client.get(f"{P}/admin/dashboard", headers=customer_headers(client)).status_code == 403
    d = client.get(f"{P}/admin/dashboard", headers=admin(client)).json()
    assert set(d["totals"]) == {"users", "sellers", "orders", "sales"} and len(d["sales_by_day"]) == 7


def test_seller_review_flow(client):
    h = admin(client)
    sid = make_pending_seller()
    lst = client.get(f"{P}/admin/sellers?status=pending", headers=h).json()
    assert lst["counts"]["pending"] == 1 and lst["items"][0]["shop_name"] == "New Shop"
    assert client.patch(f"{P}/admin/sellers/{sid}/reject", json={"reason": "  "}, headers=h).status_code == 400
    assert client.patch(f"{P}/admin/sellers/{sid}/reject", json={"reason": "ID unclear"}, headers=h).status_code == 200
    assert client.get(f"{P}/admin/sellers/{sid}", headers=h).json()["reject_reason"] == "ID unclear"
    assert client.patch(f"{P}/admin/sellers/{sid}/approve", headers=h).json()["status"] == "approved"
    assert client.patch(f"{P}/admin/sellers/{sid}/approve", headers=h).status_code == 409
    assert client.patch(f"{P}/admin/sellers/{sid}/status", json={"status": "blocked"}, headers=h).json()["status"] == "blocked"
    assert client.patch(f"{P}/admin/sellers/{sid}/status", json={"status": "approved"}, headers=h).json()["status"] == "approved"


def test_block_customer_refuses_login(client):
    h = admin(client)
    uid = client.get(f"{P}/admin/users?q=customer@", headers=h).json()["items"][0]["id"]
    assert client.patch(f"{P}/admin/users/{uid}/status", json={"status": "blocked"}, headers=h).status_code == 200
    r = client.post(f"{P}/auth/login", json={"identifier": "customer@urbancart.local", "password": "Customer@123", "role": "customer"})
    assert r.status_code == 403
    client.patch(f"{P}/admin/users/{uid}/status", json={"status": "active"}, headers=h)
    assert client.get(f"{P}/admin/users?status=blocked", headers=h).json()["total"] == 0


def test_order_status_and_cancel_restore_stock(client):
    h = admin(client)
    oid = make_order()
    assert client.get(f"{P}/admin/orders", headers=h).json()["total"] == 1
    assert client.get(f"{P}/admin/orders/{oid}", headers=h).json()["items"][0]["quantity"] == 2
    assert client.patch(f"{P}/admin/orders/{oid}/status", json={"status": "shipped"}, headers=h).json()["status"] == "shipped"
    assert client.patch(f"{P}/admin/orders/{oid}/status", json={"status": "cancelled"}, headers=h).status_code == 400
    db = Session(); before = db.query(models.Product).filter_by(name="Cotton kurta").first().stock; db.close()
    assert client.post(f"{P}/admin/orders/{oid}/cancel", json={"reason": "Stuck"}, headers=h).json()["status"] == "cancelled"
    db = Session(); after = db.query(models.Product).filter_by(name="Cotton kurta").first().stock; db.close()
    assert after == before + 2
    assert client.post(f"{P}/admin/orders/{oid}/cancel", json={}, headers=h).status_code == 409
    assert client.patch(f"{P}/admin/orders/{oid}/status", json={"status": "placed"}, headers=h).status_code == 409


def test_delivered_order_cannot_be_cancelled_and_pending_payment_hidden(client):
    h = admin(client)
    oid = make_order(status="delivered")
    assert client.post(f"{P}/admin/orders/{oid}/cancel", json={}, headers=h).status_code == 409
    db = Session(); db.query(models.Order).update({"status": "pending_payment"}); db.commit(); db.close()
    assert client.get(f"{P}/admin/orders", headers=h).json()["total"] == 0


def test_refund_owed_can_be_marked_paid_once(client):
    h = admin(client)
    oid = make_order(status="delivered")
    db = Session()
    item = db.query(models.OrderItem).first()
    r = models.ReturnRequest(order_item_id=item.id, order_id=oid, customer_id=item.order.customer_id,
                             seller_id=item.order.seller_id, quantity=1, reason="Damaged", status="refund_owed", refund_amount=839)
    db.add(r); db.commit(); rid = r.id; db.close()
    assert client.get(f"{P}/admin/returns?status=refund_owed", headers=h).json()["counts"]["refund_owed"] == 1
    assert client.patch(f"{P}/admin/returns/{rid}/refund-paid", headers=h).json()["status"] == "refunded"
    assert client.patch(f"{P}/admin/returns/{rid}/refund-paid", headers=h).status_code == 409


@pytest.mark.parametrize("period,points", [("7d", 7), ("30d", 30), ("year", 12)])
def test_reports_shape(client, period, points):
    h = admin(client)
    make_order(status="delivered")
    d = client.get(f"{P}/admin/reports?period={period}", headers=h).json()
    assert len(d["series"]) == points and d["kpis"]["orders"] == 1 and d["kpis"]["sales"] == 1678
    assert d["top_sellers"][0]["shop_name"] == "Urban Basics" and d["top_categories"][0]["name"] == "Fashion"
