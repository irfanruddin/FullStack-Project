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
    db.commit()
    db.close()
    app.dependency_overrides[get_db] = override_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def login(client, email, password, role="customer"):
    r = client.post(f"{P}/auth/login", json={"identifier": email, "password": password, "role": role})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_home_has_sections(client):
    d = client.get(f"{P}/home").json()
    assert len(d["banners"]) == 4 and len(d["offers"]) == 4 and d["new_arrivals"]


def test_list_filters_and_search(client):
    all_ = client.get(f"{P}/products?limit=48").json()
    assert all_["total"] == len(seed.DEMO_PRODUCTS)
    cats = client.get(f"{P}/categories").json()
    books = next(c for c in cats if c["name"] == "Books")
    r = client.get(f"{P}/products?category_id={books['id']}&limit=48").json()
    assert r["total"] == 6
    assert client.get(f"{P}/products?q=earbuds").json()["total"] == 1
    assert client.get(f"{P}/products?in_stock=true&limit=48").json()["total"] == len(seed.DEMO_PRODUCTS) - 1
    cheap = client.get(f"{P}/products?max_price=300&limit=48").json()["items"]
    assert cheap and all(p["price"] <= 300 for p in cheap)


def test_hidden_product_not_visible(client):
    db = Session()
    p = db.query(models.Product).first()
    p.status = "hidden"; pid = p.id; db.commit()
    assert client.get(f"{P}/products/{pid}").status_code == 404


def test_blocked_seller_products_hidden(client):
    db = Session()
    db.query(models.Seller).update({"status": "blocked"}); db.commit()
    assert client.get(f"{P}/products").json()["total"] == 0


def test_product_detail_and_stock_status(client):
    items = client.get(f"{P}/products?limit=48").json()["items"]
    sandals = next(i for i in items if i["name"] == "Leather sandals")
    assert sandals["stock_status"] == "out_of_stock"
    d = client.get(f"{P}/products/{sandals['id']}").json()
    assert d["seller"]["shop_name"] == "Urban Basics" and "rating_summary" in d


def test_review_needs_delivered_order(client):
    h = login(client, "customer@urbancart.local", "Customer@123")
    pid = client.get(f"{P}/products").json()["items"][0]["id"]
    assert client.post(f"{P}/products/{pid}/reviews", json={"rating": 5}, headers=h).status_code == 403
    db = Session()
    cust = db.query(models.User).filter_by(email="customer@urbancart.local").first()
    prod = db.get(models.Product, pid)
    order = models.Order(order_number="UC1", customer_id=cust.id, seller_id=prod.seller_id, payment_method="cod", status="delivered")
    order.items.append(models.OrderItem(product_id=pid, name=prod.name, price=prod.price, quantity=1))
    db.add(order); db.commit()
    assert client.post(f"{P}/products/{pid}/reviews", json={"rating": 5, "title": "Good"}, headers=h).status_code == 201
    assert client.post(f"{P}/products/{pid}/reviews", json={"rating": 4}, headers=h).status_code == 409


def test_wishlist_add_list_remove(client):
    h = login(client, "customer@urbancart.local", "Customer@123")
    pid = client.get(f"{P}/products").json()["items"][0]["id"]
    assert client.post(f"{P}/wishlist/{pid}", headers=h).status_code == 201
    assert client.post(f"{P}/wishlist/{pid}", headers=h).status_code == 201     # safe to repeat
    assert len(client.get(f"{P}/wishlist", headers=h).json()) == 1
    assert client.delete(f"{P}/wishlist/{pid}", headers=h).status_code == 204
    assert client.get(f"{P}/wishlist", headers=h).json() == []
    assert client.get(f"{P}/wishlist").status_code == 401
