"""Run with:  pytest   (uses a temporary SQLite database, not your MySQL one)"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app import models  # noqa: F401

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Session = sessionmaker(bind=engine)


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
    app.dependency_overrides[get_db] = override_db
    yield TestClient(app)
    app.dependency_overrides.clear()


USER = {"name": "Asha", "email": "asha@example.com", "phone": "9876543210", "password": "Pass1234"}
P = "/api/v1"


def register_and_login(client):
    assert client.post(f"{P}/auth/register", json=USER).status_code == 201
    r = client.post(f"{P}/auth/login", json={"identifier": USER["email"], "password": USER["password"], "role": "customer"})
    assert r.status_code == 200
    return r.json()


def test_register_duplicate_email(client):
    client.post(f"{P}/auth/register", json=USER)
    assert client.post(f"{P}/auth/register", json={**USER, "phone": "9876543299"}).status_code == 409


def test_login_wrong_password(client):
    client.post(f"{P}/auth/register", json=USER)
    r = client.post(f"{P}/auth/login", json={"identifier": USER["email"], "password": "wrong", "role": "customer"})
    assert r.status_code == 401


def test_wrong_role_tab_gets_same_message(client):
    client.post(f"{P}/auth/register", json=USER)
    r = client.post(f"{P}/auth/login", json={"identifier": USER["email"], "password": USER["password"], "role": "seller"})
    assert r.status_code == 401


def test_me_needs_token_and_works_with_token(client):
    assert client.get(f"{P}/auth/me").status_code == 401
    data = register_and_login(client)
    r = client.get(f"{P}/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"})
    assert r.status_code == 200 and r.json()["user"]["email"] == USER["email"]


def test_customer_cannot_use_admin_login(client):
    client.post(f"{P}/auth/register", json=USER)
    r = client.post(f"{P}/auth/admin/login", json={"email": USER["email"], "password": USER["password"]})
    assert r.status_code == 401


def test_blocked_user_is_refused(client):
    client.post(f"{P}/auth/register", json=USER)
    db = Session()
    db.query(models.User).update({"status": "blocked"})
    db.commit()
    r = client.post(f"{P}/auth/login", json={"identifier": USER["email"], "password": USER["password"], "role": "customer"})
    assert r.status_code == 403


def test_reset_link_works_once(client, capsys):
    client.post(f"{P}/auth/register", json=USER)
    client.post(f"{P}/auth/password/forgot", json={"identifier": USER["email"]})
    out = capsys.readouterr().out
    token = out.split("token=")[1].split()[0]
    assert client.post(f"{P}/auth/password/reset", json={"token": token, "new_password": "NewPass123"}).status_code == 200
    assert client.post(f"{P}/auth/password/reset", json={"token": token, "new_password": "Other1234"}).status_code == 400


def test_addresses_first_is_default_and_isolated(client):
    data = register_and_login(client)
    h = {"Authorization": f"Bearer {data['access_token']}"}
    addr = {"full_name": "Asha", "phone": "9876543210", "street": "1 MG Road", "city": "Bengaluru",
            "state": "Karnataka", "pincode": "560001", "label": "Home"}
    a1 = client.post(f"{P}/users/me/addresses", json=addr, headers=h).json()
    a2 = client.post(f"{P}/users/me/addresses", json={**addr, "label": "Work"}, headers=h).json()
    assert a1["is_default"] is True and a2["is_default"] is False
    client.put(f"{P}/users/me/addresses/{a2['id']}/default", headers=h)
    listing = client.get(f"{P}/users/me/addresses", headers=h).json()
    assert [a["is_default"] for a in listing].count(True) == 1
