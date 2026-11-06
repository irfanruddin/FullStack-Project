"""Shopping cart (customers)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import CartItem, Product, WishlistItem, User
from ..schemas import CartAdd, CartUpdate
from ..security import require_role
from ..services import (add_item, cart_lines, group_totals, buy_problem, max_quantity)

router = APIRouter(prefix="/cart", tags=["Cart"])


def cart_payload(db: Session, user: User) -> dict:
    lines = cart_lines(db, user)
    groups, totals = group_totals(lines)
    return {
        "items": [{**line, "price": float(line["price"]), "line_total": float(line["line_total"])} for line in lines],
        "groups": [{k: (float(v) if k in ("subtotal", "tax", "delivery", "total") else v) for k, v in g.items()} for g in groups],
        "totals": {k: float(v) for k, v in totals.items()},
        "count": sum(line["quantity"] for line in lines),
        "has_problems": any(line["problem"] for line in lines),
    }


def own_item(db: Session, user: User, item_id: int) -> CartItem:
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.user_id == user.id).first()
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cart item not found.")
    return item


@router.get("")
def get_cart(user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    return cart_payload(db, user)


@router.post("/items", status_code=status.HTTP_201_CREATED)
def add_to_cart(body: CartAdd, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    product = db.get(Product, body.product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This product is not available.")
    try:
        message = add_item(db, user, product, body.quantity)
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    return {"message": message, "count": cart_payload(db, user)["count"]}


@router.put("/items/{item_id}")
def change_quantity(item_id: int, body: CartUpdate, user: User = Depends(require_role("customer")),
                    db: Session = Depends(get_db)):
    item = own_item(db, user, item_id)
    problem = buy_problem(item.product, 1)
    if problem:
        raise HTTPException(status.HTTP_409_CONFLICT, problem["message"])
    if body.quantity > max_quantity(item.product):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Only {max_quantity(item.product)} can be bought at a time.")
    item.quantity = body.quantity
    db.commit()
    return cart_payload(db, user)


@router.delete("/items/{item_id}")
def remove_item(item_id: int, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    db.delete(own_item(db, user, item_id))
    db.commit()
    return cart_payload(db, user)


@router.post("/items/{item_id}/move-to-wishlist")
def move_to_wishlist(item_id: int, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    item = own_item(db, user, item_id)
    exists = db.query(WishlistItem).filter(WishlistItem.user_id == user.id,
                                           WishlistItem.product_id == item.product_id).first()
    if exists is None:
        db.add(WishlistItem(user_id=user.id, product_id=item.product_id))
    db.delete(item)
    db.commit()
    return cart_payload(db, user)
