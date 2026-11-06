"""Integration tests for the Stage 4 customer-order add-on.

Run from the existing backend directory after copying the router into app/routers:
    pytest tests/test_orders.py -q
"""
import os
os.environ.setdefault("DATABASE_URL", "sqlite://")

from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.database import Base, get_db
from app.main import app
from app.security import get_current_user
from app.routers import orders as customer_orders

app.include_router(customer_orders.router, prefix="/api/v1")

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def db_override():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


_current_customer = None


def current_user_override():
    return _current_customer


def setup_function():
    global _current_customer
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    db = TestSession()
    customer = models.User(name="Customer", email="c@example.test", phone="9000000001", password_hash="x", role="customer")
    seller_user = models.User(name="Seller", email="s@example.test", phone="9000000002", password_hash="x", role="seller")
    other = models.User(name="Other", email="o@example.test", phone="9000000003", password_hash="x", role="customer")
    db.add_all([customer, seller_user, other]); db.flush()
    seller = models.Seller(user_id=seller_user.id, shop_name="Test Shop", status="approved")
    db.add(seller); db.flush()
    category = models.Category(name="Test")
    db.add(category); db.flush()
    product = models.Product(seller_id=seller.id, category_id=category.id, name="Test item", price=100, stock=8)
    db.add(product); db.flush()
    order = models.Order(order_number="UCABC-1", customer_id=customer.id, seller_id=seller.id,
                         payment_method="cod", payment_status="pending", status="placed",
                         subtotal=100, tax=5, delivery_charge=40, total=145, placed_at=datetime.utcnow())
    db.add(order); db.flush()
    item = models.OrderItem(order_id=order.id, product_id=product.id, name="Test item", price=100, quantity=2)
    db.add(item); db.flush()
    db.add(models.OrderStatusHistory(order_id=order.id, status="placed", changed_by=customer.id))
    db.commit()
    _current_customer = customer
    db.close()
    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_current_user] = current_user_override


def teardown_function():
    app.dependency_overrides.clear()


def client():
    return TestClient(app)


def test_history_excludes_pending_payment_and_returns_tracking():
    db = TestSession()
    customer = db.query(models.User).filter_by(email="c@example.test").one()
    seller = db.query(models.Seller).one()
    db.add(models.Order(order_number="UCPEND-1", customer_id=customer.id, seller_id=seller.id,
                        payment_method="online", payment_status="pending", status="pending_payment", total=10))
    db.commit(); db.close()
    response = client().get("/api/v1/orders")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["order_number"] == "UCABC-1"
    assert response.json()[0]["tracking"][0]["status"] == "placed"


def test_customer_cannot_read_another_customers_order():
    response = client().get("/api/v1/orders/999")
    assert response.status_code == 404


def test_customer_can_cancel_before_shipment_and_stock_is_restored():
    response = client().post("/api/v1/orders/1/cancel", json={"reason": "Ordered by mistake"})
    assert response.status_code == 200
    assert response.json()["order"]["status"] == "cancelled"
    db = TestSession()
    product = db.query(models.Product).one()
    assert product.stock == 10
    assert db.query(models.OrderStatusHistory).filter_by(order_id=1, status="cancelled").count() == 1
    db.close()


def test_cancellation_after_shipment_is_rejected():
    db = TestSession()
    order = db.query(models.Order).one()
    order.status = "shipped"
    db.commit(); db.close()
    response = client().post("/api/v1/orders/1/cancel", json={"reason": "Too late"})
    assert response.status_code == 409


def test_return_requires_delivered_order_and_is_created_once():
    db = TestSession()
    order = db.query(models.Order).one()
    order.status = "delivered"
    order.delivered_at = datetime.utcnow() - timedelta(days=1)
    db.commit(); db.close()
    payload = {"order_item_id": 1, "reason": "Damaged item", "comment": "Box was damaged"}
    response = client().post("/api/v1/orders/1/returns", json=payload)
    assert response.status_code == 201
    assert response.json()["return"]["status"] == "requested"
    duplicate = client().post("/api/v1/orders/1/returns", json=payload)
    assert duplicate.status_code == 409


def test_return_rejected_outside_return_window():
    db = TestSession()
    order = db.query(models.Order).one()
    order.status = "delivered"
    order.delivered_at = datetime.utcnow() - timedelta(days=30)
    db.commit(); db.close()
    response = client().post("/api/v1/orders/1/returns", json={"order_item_id": 1, "reason": "Damaged"})
    assert response.status_code == 409


def test_refund_status_endpoint_is_customer_scoped():
    response = client().get("/api/v1/orders/1/refund-status")
    assert response.status_code == 200
    assert response.json()["refund_status"] == "not_applicable"
