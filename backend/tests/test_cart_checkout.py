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
ADDR = {"full_name": "Asha", "phone": "9876543210", "street": "1 MG Road", "city": "Bengaluru",
        "state": "Karnataka", "pincode": "560001", "label": "Home"}


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
    # a second seller with one product, to test "one order per seller"
    u = models.User(name="Second Seller", email="s2@example.com", phone="9000000555",
                    password_hash=hash_password("Seller@123"), role="seller")
    db.add(u); db.flush()
    s2 = models.Seller(user_id=u.id, shop_name="Second Shop", status="approved")
    db.add(s2); db.flush()
    cat = db.query(models.Category).filter(models.Category.parent_id != None).first()  # noqa: E711
    db.add(models.Product(seller_id=s2.id, category_id=cat.id, name="Second product", price=1000, stock=10))
    db.commit(); db.close()
    app.dependency_overrides[get_db] = override_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def customer(client):
    r = client.post(f"{P}/auth/login", json={"identifier": "customer@urbancart.local", "password": "Customer@123", "role": "customer"})
    if r.status_code != 200:
        db = Session()
        db.add(models.User(name="Cust", email="customer@urbancart.local", phone="9000000001",
                           password_hash=hash_password("Customer@123"), role="customer"))
        db.commit(); db.close()
        r = client.post(f"{P}/auth/login", json={"identifier": "customer@urbancart.local", "password": "Customer@123", "role": "customer"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def pid(client, name):
    return next(p["id"] for p in client.get(f"{P}/products?limit=48&q={name}").json()["items"] if p["name"] == name)


def stock_of(name):
    db = Session()
    try:
        return db.query(models.Product).filter_by(name=name).first().stock
    finally:
        db.close()


def add(client, h, name, qty=1):
    return client.post(f"{P}/cart/items", json={"product_id": pid(client, name), "quantity": qty}, headers=h)


def addr(client, h):
    return client.post(f"{P}/users/me/addresses", json=ADDR, headers=h).json()["id"]


def test_cart_caps_at_stock_and_refuses_out_of_stock(client):
    h = customer(client)
    assert add(client, h, "Canvas sneakers", 2).status_code == 201       # stock is 3
    assert add(client, h, "Canvas sneakers", 2).status_code == 201       # capped at 3
    assert client.get(f"{P}/cart", headers=h).json()["items"][0]["quantity"] == 3
    assert add(client, h, "Canvas sneakers", 1).status_code == 409
    assert add(client, h, "Leather sandals").status_code == 409          # stock is 0


def test_totals_tax_and_delivery(client):
    h = customer(client)
    add(client, h, "Cotton kurta", 2)                                    # 2 x 799 = 1598, above 500
    t = client.get(f"{P}/cart", headers=h).json()["totals"]
    assert t["subtotal"] == 1598 and t["tax"] == 79.9 and t["delivery"] == 0 and t["total"] == 1677.9
    client.delete(f"{P}/cart/items/{client.get(f'{P}/cart', headers=h).json()['items'][0]['id']}", headers=h)
    add(client, h, "Phone case", 1)                                      # 299, under 500
    t = client.get(f"{P}/cart", headers=h).json()["totals"]
    assert t["delivery"] == 40 and t["total"] == 299 + 14.95 + 40


def test_cod_creates_one_order_per_seller_and_reduces_stock(client):
    h = customer(client)
    a = addr(client, h)
    add(client, h, "Cotton kurta", 2); add(client, h, "Second product", 1)
    r = client.post(f"{P}/orders", json={"address_id": a, "payment_method": "cod"}, headers=h)
    assert r.status_code == 201 and len(r.json()["orders"]) == 2 and r.json()["next"] == "done"
    assert stock_of("Cotton kurta") == 38 and stock_of("Second product") == 9
    assert client.get(f"{P}/cart", headers=h).json()["items"] == []


def test_online_payment_fail_then_success(client):
    h = customer(client)
    a = addr(client, h)
    add(client, h, "Cotton kurta", 1)
    ref = client.post(f"{P}/orders", json={"address_id": a, "payment_method": "online"}, headers=h).json()["ref"]
    assert stock_of("Cotton kurta") == 40                                # nothing reduced yet
    card = {"ref": ref, "method": "card", "name": "Asha", "expiry": "12/40", "cvv": "123"}
    bad = client.post(f"{P}/payments/test-pay", json={**card, "card_number": "4111 1111 1111 0000"}, headers=h).json()
    assert bad["status"] == "failed" and stock_of("Cotton kurta") == 40
    ok = client.post(f"{P}/payments/test-pay", json={**card, "card_number": "4111 1111 1111 1111"}, headers=h).json()
    assert ok["status"] == "success" and stock_of("Cotton kurta") == 39
    again = client.post(f"{P}/payments/test-pay", json={**card, "card_number": "4111 1111 1111 1111"}, headers=h).json()
    assert again["status"] == "success" and stock_of("Cotton kurta") == 39    # not charged twice


def test_validate_reports_sold_out_item(client):
    h = customer(client)
    add(client, h, "Canvas sneakers", 2)
    db = Session(); db.query(models.Product).filter_by(name="Canvas sneakers").update({"stock": 0}); db.commit(); db.close()
    v = client.post(f"{P}/checkout/validate", json={}, headers=h).json()
    assert v["ok"] is False and v["problems"][0]["code"] == "out_of_stock"
    a = addr(client, h)
    r = client.post(f"{P}/orders", json={"address_id": a, "payment_method": "cod"}, headers=h)
    assert r.status_code == 409 and r.json()["detail"]["problems"]


def test_invoice_only_for_placed_orders(client):
    h = customer(client)
    a = addr(client, h)
    add(client, h, "Cotton kurta", 1)
    placed = client.post(f"{P}/orders", json={"address_id": a, "payment_method": "cod"}, headers=h).json()
    inv = client.get(f"{P}/orders/{placed['orders'][0]['id']}/invoice", headers=h)
    assert inv.status_code == 200 and "Invoice" in inv.text and "attachment" in inv.headers["content-disposition"]
    add(client, h, "Cotton kurta", 1)
    pending = client.post(f"{P}/orders", json={"address_id": a, "payment_method": "online"}, headers=h).json()
    assert client.get(f"{P}/orders/{pending['orders'][0]['id']}/invoice", headers=h).status_code == 404


def test_move_between_cart_and_wishlist(client):
    h = customer(client)
    add(client, h, "Cotton kurta", 1)
    item = client.get(f"{P}/cart", headers=h).json()["items"][0]["id"]
    client.post(f"{P}/cart/items/{item}/move-to-wishlist", headers=h)
    assert client.get(f"{P}/cart", headers=h).json()["items"] == []
    assert len(client.get(f"{P}/wishlist", headers=h).json()) == 1
    client.post(f"{P}/wishlist/{pid(client, 'Leather sandals')}", headers=h)    # out of stock
    r = client.post(f"{P}/wishlist/move-all-to-cart", headers=h).json()
    assert r["moved"] == 1 and r["skipped"] == ["Leather sandals"]
