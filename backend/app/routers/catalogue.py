"""Public catalogue: home page data, categories, product list and search, product page, reviews."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..models import (Product, Seller, User, Category, Review, OrderItem, Order, WishlistItem)
from ..schemas import ReviewIn
from ..security import get_optional_user, require_role

router = APIRouter(tags=["Catalogue"])


# ---------- helpers ----------
def stock_status(stock: int) -> str:
    if stock <= 0:
        return "out_of_stock"
    return "low_stock" if stock <= settings.LOW_STOCK_LIMIT else "in_stock"


def visible_filter(query):
    """Only active products of approved, unblocked sellers are shown to customers."""
    return (query.join(Seller, Product.seller_id == Seller.id)
            .join(User, Seller.user_id == User.id)
            .filter(Product.status == "active", Seller.status == "approved", User.status == "active"))


def rating_subquery(db: Session):
    return (db.query(Review.product_id.label("pid"), func.avg(Review.rating).label("avg"),
                     func.count(Review.id).label("cnt")).group_by(Review.product_id).subquery())


def sold_subquery(db: Session):
    return (db.query(OrderItem.product_id.label("pid"), func.sum(OrderItem.quantity).label("sold"))
            .join(Order, Order.id == OrderItem.order_id).filter(Order.status != "cancelled")
            .group_by(OrderItem.product_id).subquery())


def base_query(db: Session):
    """Returns rows of (Product, average rating, review count, units sold)."""
    r, s = rating_subquery(db), sold_subquery(db)
    q = (db.query(Product, r.c.avg, r.c.cnt, s.c.sold)
         .outerjoin(r, r.c.pid == Product.id).outerjoin(s, s.c.pid == Product.id))
    return visible_filter(q), r, s


def card(row) -> dict:
    product, avg, cnt, _sold = row
    return {
        "id": product.id,
        "name": product.name,
        "price": float(product.price),
        "stock": product.stock,
        "stock_status": stock_status(product.stock),
        "image": product.images[0].file_path if product.images else None,
        "seller_name": product.seller.shop_name,
        "category": product.category.name if product.category else None,
        "avg_rating": round(float(avg), 1) if avg is not None else 0,
        "review_count": int(cnt or 0),
    }


def review_summary(db: Session, product_id: int) -> dict:
    rows = (db.query(Review.rating, func.count(Review.id)).filter(Review.product_id == product_id)
            .group_by(Review.rating).all())
    counts = {i: 0 for i in range(1, 6)}
    for rating, n in rows:
        counts[int(rating)] = int(n)
    total = sum(counts.values())
    avg = round(sum(k * v for k, v in counts.items()) / total, 1) if total else 0
    return {"average": avg, "count": total, "breakdown": counts}


def short_name(name: str) -> str:
    parts = name.split()
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0]}."


def has_bought(db: Session, user_id: int, product_id: int) -> bool:
    return db.query(OrderItem.id).join(Order, Order.id == OrderItem.order_id).filter(
        Order.customer_id == user_id, Order.status == "delivered", OrderItem.product_id == product_id).first() is not None


# ---------- home page ----------
def home_banners(db: Session):
    def cat(name):
        c = db.query(Category).filter(Category.name == name, Category.parent_id == None).first()  # noqa: E711
        return f"/category/{c.id}" if c else "/products"
    return [
        {"id": 1, "title": "Online shopping", "subtitle": "Limited time only", "cta": "Shop now", "link": "/products", "image": None},
        {"id": 2, "title": "Fresh arrivals", "subtitle": "New styles and gadgets every week", "cta": "See what's new", "link": "/products?sort=newest", "image": None},
        {"id": 3, "title": "Back to study", "subtitle": "Books, stationery and more", "cta": "Shop books", "link": cat("Books"), "image": None},
        {"id": 4, "title": "Small sellers, big choice", "subtitle": "Every seller is approved by an admin", "cta": "Start shopping", "link": "/products", "image": None},
    ]


@router.get("/home")
def home(db: Session = Depends(get_db)):
    def top(sort, limit=4):
        q, r, s = base_query(db)
        if sort == "trending":
            q = q.order_by(func.coalesce(s.c.sold, 0).desc(), Product.id.desc())
        elif sort == "top_rated":
            q = q.filter(r.c.cnt >= 1).order_by(func.coalesce(r.c.avg, 0).desc(), r.c.cnt.desc())
        else:
            q = q.order_by(Product.id.desc())
        return [card(row) for row in q.limit(limit).all()]

    return {
        "banners": home_banners(db),
        "offers": [
            {"title": "Free delivery", "text": f"On orders above ₹{settings.FREE_DELIVERY_ABOVE:g}"},
            {"title": "Cash on delivery", "text": "Pay when your order arrives"},
            {"title": "Easy returns", "text": f"Within {settings.RETURN_WINDOW_DAYS} days of delivery"},
            {"title": "Approved sellers", "text": "Every seller is checked by an admin"},
        ],
        "trending": top("trending"),
        "top_rated": top("top_rated"),
        "new_arrivals": top("newest"),
    }


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    parents = db.query(Category).filter(Category.parent_id == None).order_by(Category.id).all()  # noqa: E711
    return [{"id": p.id, "name": p.name,
             "children": [{"id": c.id, "name": c.name} for c in sorted(p.children, key=lambda x: x.id)]}
            for p in parents]


# ---------- product list and search ----------
@router.get("/products")
def list_products(
    category_id: Optional[int] = None, sub_id: Optional[int] = None, q: Optional[str] = None,
    min_price: Optional[float] = None, max_price: Optional[float] = None,
    rating: Optional[float] = None, in_stock: bool = False,
    sort: str = "newest", page: int = Query(1, ge=1), limit: int = Query(9, ge=1, le=48),
    db: Session = Depends(get_db),
):
    query, r, s = base_query(db)
    heading = None
    if sub_id:
        query = query.filter(Product.category_id == sub_id)
        cat = db.get(Category, sub_id)
        heading = cat.name if cat else None
    elif category_id:
        cat = db.get(Category, category_id)
        if cat is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found.")
        ids = [cat.id] + [c.id for c in cat.children]
        query = query.filter(Product.category_id.in_(ids))
        heading = cat.name
    if q and q.strip():
        for word in q.split():
            like = f"%{word}%"
            query = query.filter((Product.name.ilike(like)) | (Product.description.ilike(like))
                                 | (Seller.shop_name.ilike(like))
                                 | (Product.category_id.in_(
                                     db.query(Category.id).filter(Category.name.ilike(like)))))
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)
    if rating:
        query = query.filter(func.coalesce(r.c.avg, 0) >= rating)
    if in_stock:
        query = query.filter(Product.stock > 0)

    if sort == "price_low":
        query = query.order_by(Product.price.asc(), Product.id.desc())
    elif sort == "price_high":
        query = query.order_by(Product.price.desc(), Product.id.desc())
    elif sort == "popularity":
        query = query.order_by(func.coalesce(s.c.sold, 0).desc(), Product.id.desc())
    elif sort == "rating":
        query = query.order_by(func.coalesce(r.c.avg, 0).desc(), Product.id.desc())
    elif sort == "relevance" and q:
        query = query.order_by(case((Product.name.ilike(f"{q.split()[0]}%"), 0), else_=1), Product.id.desc())
    else:
        query = query.order_by(Product.id.desc())

    total = query.count()
    rows = query.offset((page - 1) * limit).limit(limit).all()
    return {"items": [card(row) for row in rows], "total": total, "page": page,
            "pages": max(1, -(-total // limit)), "heading": heading}


# ---------- product page ----------
@router.get("/products/{product_id}")
def product_detail(product_id: int, db: Session = Depends(get_db), user: Optional[User] = Depends(get_optional_user)):
    query, _r, _s = base_query(db)
    row = query.filter(Product.id == product_id).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This product is not available.")
    product = row[0]
    data = card(row)
    data.update({
        "description": product.description or "",
        "images": [i.file_path for i in product.images],
        "seller": {"id": product.seller.id, "shop_name": product.seller.shop_name},
        "category_id": product.category_id,
        "parent_category": ({"id": product.category.parent_id,
                             "name": db.get(Category, product.category.parent_id).name}
                            if product.category and product.category.parent_id else None),
        "rating_summary": review_summary(db, product.id),
        "return_window_days": settings.RETURN_WINDOW_DAYS,
        "free_delivery_above": settings.FREE_DELIVERY_ABOVE,
        "me": None,
    })
    if user is not None and user.role == "customer":
        reviewed = db.query(Review.id).filter(Review.product_id == product.id, Review.user_id == user.id).first() is not None
        data["me"] = {
            "in_wishlist": db.query(WishlistItem.id).filter(WishlistItem.user_id == user.id,
                                                            WishlistItem.product_id == product.id).first() is not None,
            "has_reviewed": reviewed,
            "can_review": has_bought(db, user.id, product.id) and not reviewed,
        }
    related_q, _r2, _s2 = base_query(db)
    related = (related_q.filter(Product.category_id == product.category_id, Product.id != product.id)
               .order_by(Product.id.desc()).limit(4).all())
    data["related"] = [card(x) for x in related]
    return data


@router.get("/products/{product_id}/reviews")
def list_reviews(product_id: int, page: int = Query(1, ge=1), limit: int = Query(10, ge=1, le=50),
                 db: Session = Depends(get_db)):
    if db.get(Product, product_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
    q = db.query(Review).filter(Review.product_id == product_id).order_by(Review.id.desc())
    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()
    return {
        "summary": review_summary(db, product_id),
        "total": total, "page": page, "pages": max(1, -(-total // limit)),
        "items": [{"id": rv.id, "name": short_name(rv.user.name), "rating": rv.rating, "title": rv.title,
                   "body": rv.body, "created_at": rv.created_at.isoformat(), "verified": True} for rv in items],
    }


@router.post("/products/{product_id}/reviews", status_code=status.HTTP_201_CREATED)
def write_review(product_id: int, body: ReviewIn, user: User = Depends(require_role("customer")),
                 db: Session = Depends(get_db)):
    """Only a customer whose order of this product was delivered can review it, once."""
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found.")
    if not has_bought(db, user.id, product_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only customers who received this product can review it.")
    if db.query(Review.id).filter(Review.product_id == product_id, Review.user_id == user.id).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already reviewed this product.")
    review = Review(product_id=product_id, user_id=user.id, rating=body.rating, title=body.title, body=body.body)
    db.add(review)
    db.commit()
    return {"message": "Thanks for your review.", "summary": review_summary(db, product_id)}
