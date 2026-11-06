"""Every table in UrbanCart. Each module owner works with the tables they own,
but all tables live here so the ER diagram has one source."""
from datetime import datetime
from sqlalchemy import (Column, Integer, String, Text, Numeric, Boolean, DateTime,
                        ForeignKey, UniqueConstraint)
from sqlalchemy.orm import relationship
from .database import Base


def now():
    return datetime.utcnow()


# ---------- Accounts (authentication and profile) ----------
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    phone = Column(String(15), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="customer")    # customer, seller, admin
    status = Column(String(20), nullable=False, default="active")    # active, blocked
    created_at = Column(DateTime, default=now)

    addresses = relationship("Address", back_populates="user", cascade="all, delete-orphan")
    seller = relationship("Seller", back_populates="user", uselist=False)


class Address(Base):
    __tablename__ = "addresses"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(15), nullable=False)
    street = Column(String(255), nullable=False)
    city = Column(String(80), nullable=False)
    state = Column(String(80), nullable=False)
    pincode = Column(String(10), nullable=False)
    label = Column(String(10), default="Home")          # Home or Work
    is_default = Column(Boolean, default=False)
    user = relationship("User", back_populates="addresses")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)


# ---------- Seller and catalogue ----------
class Seller(Base):
    __tablename__ = "sellers"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    shop_name = Column(String(120), nullable=False)
    description = Column(Text)
    category = Column(String(80))
    pickup_address = Column(String(255))
    city = Column(String(80))
    pincode = Column(String(10))
    logo_path = Column(String(255))
    status = Column(String(20), default="pending")      # pending, approved, rejected, blocked
    reject_reason = Column(Text)
    approved_at = Column(DateTime)
    created_at = Column(DateTime, default=now)
    user = relationship("User", back_populates="seller")
    documents = relationship("SellerDocument", back_populates="seller", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="seller")


class SellerDocument(Base):
    __tablename__ = "seller_documents"
    id = Column(Integer, primary_key=True)
    seller_id = Column(Integer, ForeignKey("sellers.id"), nullable=False)
    kind = Column(String(20), nullable=False)           # id_proof, business_proof
    file_path = Column(String(255), nullable=False)
    original_name = Column(String(255))
    seller = relationship("Seller", back_populates="documents")


class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True)
    name = Column(String(80), nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"))
    children = relationship("Category")


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    seller_id = Column(Integer, ForeignKey("sellers.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text)
    price = Column(Numeric(10, 2), nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    status = Column(String(20), default="active")       # active, hidden
    created_at = Column(DateTime, default=now)
    seller = relationship("Seller", back_populates="products")
    category = relationship("Category")
    images = relationship("ProductImage", cascade="all, delete-orphan", order_by="ProductImage.position")


class ProductImage(Base):
    __tablename__ = "product_images"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    file_path = Column(String(255), nullable=False)
    position = Column(Integer, default=0)


# ---------- Cart and wishlist ----------
class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("user_id", "product_id"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    product = relationship("Product")


class WishlistItem(Base):
    __tablename__ = "wishlist_items"
    __table_args__ = (UniqueConstraint("user_id", "product_id"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    created_at = Column(DateTime, default=now)
    product = relationship("Product")


# ---------- Orders, payment, returns ----------
class Order(Base):
    """One order belongs to one seller. A cart with items from several sellers
    becomes several orders (the default we chose for the open point)."""
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    order_number = Column(String(20), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("sellers.id"), nullable=False, index=True)
    # Address copied at order time so later address edits do not change old orders
    ship_name = Column(String(100)); ship_phone = Column(String(15))
    ship_street = Column(String(255)); ship_city = Column(String(80))
    ship_state = Column(String(80)); ship_pincode = Column(String(10))
    payment_method = Column(String(10), nullable=False)             # cod, online
    payment_status = Column(String(15), default="pending")          # pending, paid, failed
    status = Column(String(15), default="placed")                   # placed, confirmed, shipped, delivered, cancelled
    subtotal = Column(Numeric(10, 2), default=0)
    tax = Column(Numeric(10, 2), default=0)
    delivery_charge = Column(Numeric(10, 2), default=0)
    total = Column(Numeric(10, 2), default=0)
    cancel_reason = Column(String(255))
    placed_at = Column(DateTime, default=now)
    delivered_at = Column(DateTime)
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    history = relationship("OrderStatusHistory", cascade="all, delete-orphan", order_by="OrderStatusHistory.id")
    customer = relationship("User")
    seller = relationship("Seller")


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    name = Column(String(200), nullable=False)          # copied so renames do not change history
    price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)
    order = relationship("Order", back_populates="items")
    product = relationship("Product")


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    status = Column(String(15), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"))
    changed_at = Column(DateTime, default=now)


class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    method = Column(String(10), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    status = Column(String(15), default="pending")      # pending, success, failed, refunded
    reference = Column(String(40))
    created_at = Column(DateTime, default=now)


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("product_id", "user_id"),)
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    title = Column(String(150))
    body = Column(Text)
    created_at = Column(DateTime, default=now)
    user = relationship("User")


class ReturnRequest(Base):
    __tablename__ = "returns"
    id = Column(Integer, primary_key=True)
    order_item_id = Column(Integer, ForeignKey("order_items.id"), nullable=False, unique=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("sellers.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    reason = Column(String(150), nullable=False)
    comment = Column(Text)
    # requested, approved, rejected, shipped_back, received, refunded, refund_owed
    status = Column(String(20), default="requested")
    reject_reason = Column(Text)
    refund_amount = Column(Numeric(10, 2))
    requested_at = Column(DateTime, default=now)
    decided_at = Column(DateTime)
    shipped_back_at = Column(DateTime)
    received_at = Column(DateTime)
    refunded_at = Column(DateTime)
    order_item = relationship("OrderItem")
