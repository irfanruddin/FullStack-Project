"""Seller workspace: own shop, catalogue, orders, returns and sales summary."""

import os
import io
import cloudinary
import cloudinary.uploader

from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..database import get_db
from ..models import (Seller, User, Product, ProductImage, Category, Order, OrderItem,
                      OrderStatusHistory, ReturnRequest, now)
from ..security import get_approved_seller, require_role, hash_password

router = APIRouter(prefix="/seller", tags=["Seller workspace"])


class SellerApplyIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str
    phone: str
    password: str = Field(min_length=8, max_length=64)
    shop_name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=10000)
    category: str | None = Field(default=None, max_length=80)
    pickup_address: str = Field(min_length=5, max_length=255)
    city: str = Field(min_length=2, max_length=80)
    pincode: str = Field(min_length=6, max_length=10)


class ProductIn(BaseModel):
    category_id: int
    name: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=10000)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    stock: int = Field(ge=0)
    status: str = "active"


class ProfileIn(BaseModel):
    shop_name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=10000)
    category: str | None = Field(default=None, max_length=80)
    pickup_address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=80)
    pincode: str | None = Field(default=None, max_length=10)


class StatusIn(BaseModel):
    status: str


class ReturnDecisionIn(BaseModel):
    status: str
    reject_reason: str | None = Field(default=None, max_length=2000)


def product_data(p: Product):
    return {"id": p.id, "category_id": p.category_id, "category_name": p.category.name if p.category else None,
            "name": p.name, "description": p.description, "price": float(p.price), "stock": p.stock,
            "status": p.status, "created_at": p.created_at.isoformat() if p.created_at else None,
            "images": [{"id": i.id, "file_path": i.file_path, "position": i.position} for i in p.images]}


def order_data(o: Order):
    return {"id": o.id, "order_number": o.order_number, "status": o.status,
            "payment_method": o.payment_method, "payment_status": o.payment_status,
            "total": float(o.total or 0), "placed_at": o.placed_at.isoformat() if o.placed_at else None,
            "customer_name": o.ship_name, "customer_phone": o.ship_phone,
            "shipping_address": ", ".join(x for x in [o.ship_street, o.ship_city, o.ship_state, o.ship_pincode] if x),
            "items": [{"id": i.id, "name": i.name, "price": float(i.price), "quantity": i.quantity} for i in o.items]}


@router.post("/apply", status_code=status.HTTP_201_CREATED)
def apply_as_seller(body: SellerApplyIn, db: Session = Depends(get_db)):
    """Create a seller login and a pending shop application for admin review."""
    email = body.email.strip().lower()
    phone = body.phone.strip()
    if "@" not in email or len(phone) != 10 or not phone.isdigit():
        raise HTTPException(400, "Enter a valid email address and 10-digit phone number.")
    if not any(ch.isalpha() for ch in body.password) or not any(ch.isdigit() for ch in body.password):
        raise HTTPException(400, "Password must contain at least one letter and one number.")
    if db.query(User).filter((User.email == email) | (User.phone == phone)).first():
        raise HTTPException(409, "An account with this email or phone number already exists.")
    user = User(name=body.name.strip(), email=email, phone=phone,
                password_hash=hash_password(body.password), role="seller", status="active")
    db.add(user)
    db.flush()
    seller = Seller(user_id=user.id, shop_name=body.shop_name.strip(),
                    description=body.description, category=body.category,
                    pickup_address=body.pickup_address.strip(), city=body.city.strip(),
                    pincode=body.pincode.strip(), status="pending")
    db.add(seller)
    db.commit()
    return {"message": "Seller application submitted. You can log in to check its status.", "status": "pending"}


@router.get("/dashboard")
def dashboard(seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.seller_id == seller.id).all()
    orders = (db.query(Order).options(joinedload(Order.items)).filter(Order.seller_id == seller.id,
              Order.status != "pending_payment").order_by(Order.placed_at.desc()).limit(8).all())
    total_orders = db.query(func.count(Order.id)).filter(Order.seller_id == seller.id,
                    Order.status != "pending_payment").scalar() or 0
    revenue = db.query(func.coalesce(func.sum(Order.total), 0)).filter(Order.seller_id == seller.id,
                Order.status.in_(["confirmed", "shipped", "delivered"])).scalar() or 0
    return {"shop_name": seller.shop_name, "stats": {"products": len(products),
            "active_products": sum(p.status == "active" for p in products), "low_stock": sum(0 < p.stock <= settings.LOW_STOCK_LIMIT for p in products),
            "out_of_stock": sum(p.stock == 0 for p in products), "orders": total_orders, "sales": float(revenue)},
            "low_stock_products": [product_data(p) for p in products if p.stock <= settings.LOW_STOCK_LIMIT],
            "recent_orders": [order_data(o) for o in orders]}


@router.get("/profile")
def get_profile(seller: Seller = Depends(get_approved_seller)):
    return {"shop_name": seller.shop_name, "description": seller.description, "category": seller.category,
            "pickup_address": seller.pickup_address, "city": seller.city, "pincode": seller.pincode,
            "logo_path": seller.logo_path, "status": seller.status}


@router.put("/profile")
def update_profile(body: ProfileIn, seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    for key, value in body.model_dump().items():
        setattr(seller, key, value)
    db.commit()
    return {"message": "Shop profile updated."}


@router.get("/categories")
def seller_categories(seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    return [{"id": c.id, "name": c.name} for c in db.query(Category).order_by(Category.name).all()]


@router.get("/products")
def list_products(seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    rows = db.query(Product).options(joinedload(Product.category), joinedload(Product.images)).filter(
        Product.seller_id == seller.id).order_by(Product.created_at.desc()).all()
    return [product_data(p) for p in rows]


@router.post("/products", status_code=status.HTTP_201_CREATED)
def create_product(body: ProductIn, seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    if body.status not in ("active", "hidden"):
        raise HTTPException(400, "Product status must be active or hidden.")
    if db.get(Category, body.category_id) is None:
        raise HTTPException(404, "Category not found.")
    p = Product(seller_id=seller.id, **body.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    return product_data(p)


@router.put("/products/{product_id}")
def update_product(product_id: int, body: ProductIn, seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id, Product.seller_id == seller.id).first()
    if p is None: raise HTTPException(404, "Product not found.")
    if db.get(Category, body.category_id) is None: raise HTTPException(404, "Category not found.")
    if body.status not in ("active", "hidden"): raise HTTPException(400, "Invalid product status.")
    for k, v in body.model_dump().items(): setattr(p, k, v)
    db.commit(); db.refresh(p)
    return product_data(p)


@router.delete("/products/{product_id}")
def delete_product(product_id: int, seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id, Product.seller_id == seller.id).first()
    if p is None: raise HTTPException(404, "Product not found.")
    if db.query(OrderItem).filter(OrderItem.product_id == p.id).first():
        p.status = "hidden"
        db.commit()
        return {"message": "This product has order history, so it was hidden instead of permanently deleted."}
    db.delete(p); db.commit()
    return {"message": "Product deleted."}

@router.post("/products/{product_id}/images", status_code=201)
def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    seller: Seller = Depends(get_approved_seller),
    db: Session = Depends(get_db)
):
    p = db.query(Product).filter(
        Product.id == product_id,
        Product.seller_id == seller.id
    ).first()

    if p is None:
        raise HTTPException(404, "Product not found.")

    allowed = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
    }

    if file.content_type not in allowed:
        raise HTTPException(
            415,
            "Upload a JPG, PNG or WEBP image."
        )

    data = file.file.read(5 * 1024 * 1024 + 1)

    if not data or len(data) > 5 * 1024 * 1024:
        raise HTTPException(
            400,
            "Image must be between 1 byte and 5 MB."
        )

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")

    if not all([cloud_name, api_key, api_secret]):
        raise HTTPException(
            500,
            "Cloudinary configuration is missing."
        )

    try:
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )

        result = cloudinary.uploader.upload(
            io.BytesIO(data),
            folder="urbancart/products",
            public_id=uuid4().hex,
            resource_type="image"
        )

        image_url = result["secure_url"]

        image = ProductImage(
            product_id=p.id,
            file_path=image_url,
            position=len(p.images)
        )

        db.add(image)
        db.commit()
        db.refresh(image)

        return {
            "id": image.id,
            "file_path": image.file_path,
            "position": image.position
        }

    except HTTPException:
        raise

    except Exception as e:
        db.rollback()
        raise HTTPException(
            500,
            f"Image upload failed: {str(e)}"
        )
@router.delete("/products/{product_id}/images/{image_id}")
def delete_product_image(product_id: int, image_id: int, seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    image = db.query(ProductImage).join(Product).filter(Product.id == product_id, Product.seller_id == seller.id,
             ProductImage.id == image_id).first()
    if image is None: raise HTTPException(404, "Image not found.")
    path = Path(settings.UPLOAD_DIR) / image.file_path
    db.delete(image); db.commit()
    if path.exists(): path.unlink()
    return {"message": "Image removed."}


@router.get("/orders")
def list_orders(seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    rows = db.query(Order).options(joinedload(Order.items)).filter(Order.seller_id == seller.id,
        Order.status != "pending_payment").order_by(Order.placed_at.desc()).all()
    return [order_data(o) for o in rows]


@router.patch("/orders/{order_id}/status")
def update_order_status(order_id: int, body: StatusIn, user: User = Depends(require_role("seller")), db: Session = Depends(get_db)):
    seller = db.query(Seller).filter(Seller.user_id == user.id, Seller.status == "approved").first()
    if seller is None: raise HTTPException(403, "Your seller account is not approved yet.")
    order = db.query(Order).filter(Order.id == order_id, Order.seller_id == seller.id).with_for_update().first()
    if order is None or order.status == "pending_payment": raise HTTPException(404, "Order not found.")
    allowed = {"placed": "confirmed", "confirmed": "shipped", "shipped": "delivered"}
    if allowed.get(order.status) != body.status: raise HTTPException(400, "Invalid status change. Orders must move placed → confirmed → shipped → delivered.")
    order.status = body.status
    if body.status == "delivered": order.delivered_at = now()
    db.add(OrderStatusHistory(order_id=order.id, status=body.status, changed_by=user.id))
    db.commit()
    return {"message": f"Order marked {body.status}.", "status": order.status}


@router.get("/returns")
def list_returns(seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    rows = db.query(ReturnRequest).filter(ReturnRequest.seller_id == seller.id).order_by(ReturnRequest.requested_at.desc()).all()
    return [{"id": r.id, "order_id": r.order_id, "order_item_id": r.order_item_id, "quantity": r.quantity,
             "reason": r.reason, "comment": r.comment, "status": r.status, "reject_reason": r.reject_reason,
             "requested_at": r.requested_at.isoformat() if r.requested_at else None} for r in rows]


@router.patch("/returns/{return_id}")
def decide_return(return_id: int, body: ReturnDecisionIn, seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    r = db.query(ReturnRequest).filter(ReturnRequest.id == return_id, ReturnRequest.seller_id == seller.id).with_for_update().first()
    if r is None: raise HTTPException(404, "Return request not found.")
    if r.status != "requested": raise HTTPException(400, "Only requested returns can be approved or rejected.")
    if body.status not in ("approved", "rejected"): raise HTTPException(400, "Choose approved or rejected.")
    if body.status == "rejected" and not (body.reject_reason or "").strip(): raise HTTPException(400, "Please provide a reason for rejection.")
    r.status = body.status; r.reject_reason = body.reject_reason.strip() if body.reject_reason else None; r.decided_at = now()
    db.commit()
    return {"message": f"Return request {body.status}.", "status": r.status}


@router.get("/reports/sales")
def sales_report(days: int = 30, seller: Seller = Depends(get_approved_seller), db: Session = Depends(get_db)):
    if days not in (7, 30, 90, 365): raise HTTPException(400, "Days must be 7, 30, 90 or 365.")
    since = datetime.utcnow() - timedelta(days=days)
    rows = db.query(Order).filter(Order.seller_id == seller.id, Order.placed_at >= since,
             Order.status.in_(["confirmed", "shipped", "delivered"])).order_by(Order.placed_at.asc()).all()
    return {"days": days, "order_count": len(rows), "sales_total": sum((Decimal(o.total or 0) for o in rows), Decimal("0.00")),
            "orders": [{"order_number": o.order_number, "date": o.placed_at.isoformat() if o.placed_at else None,
                        "status": o.status, "total": float(o.total or 0), "payment_method": o.payment_method} for o in rows]}
