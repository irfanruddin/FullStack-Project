"""Wishlist (customers), including moving items to the cart."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import WishlistItem, Product, User
from ..security import require_role
from ..services import add_item
from .catalogue import base_query, card

router = APIRouter(prefix="/wishlist", tags=["Wishlist"])


@router.get("")
def list_wishlist(user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    q, _r, _s = base_query(db)
    rows = (q.join(WishlistItem, WishlistItem.product_id == Product.id)
            .filter(WishlistItem.user_id == user.id).order_by(WishlistItem.id.desc()).all())
    return [card(row) for row in rows]


# This route must come before "/{product_id}" so "move-all-to-cart" is not read as an id.
@router.post("/move-all-to-cart")
def move_all_to_cart(user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    moved, skipped = 0, []
    for entry in db.query(WishlistItem).filter(WishlistItem.user_id == user.id).all():
        try:
            add_item(db, user, entry.product, 1)
        except ValueError:
            skipped.append(entry.product.name)      # out of stock or no longer available: stays in the wishlist
            continue
        db.delete(entry)
        db.commit()
        moved += 1
    return {"moved": moved, "skipped": skipped}


@router.post("/{product_id}/move-to-cart")
def move_to_cart(product_id: int, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    entry = db.query(WishlistItem).filter(WishlistItem.user_id == user.id, WishlistItem.product_id == product_id).first()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This product is not in your wishlist.")
    try:
        message = add_item(db, user, entry.product, 1)
    except ValueError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    db.delete(entry)
    db.commit()
    return {"message": message}


@router.post("/{product_id}", status_code=status.HTTP_201_CREATED)
def add_to_wishlist(product_id: int, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    q, _r, _s = base_query(db)
    if q.filter(Product.id == product_id).first() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This product is not available.")
    exists = db.query(WishlistItem).filter(WishlistItem.user_id == user.id, WishlistItem.product_id == product_id).first()
    if exists is None:                      # safe to repeat
        db.add(WishlistItem(user_id=user.id, product_id=product_id))
        db.commit()
    return {"message": "Saved to your wishlist."}


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_wishlist(product_id: int, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    db.query(WishlistItem).filter(WishlistItem.user_id == user.id, WishlistItem.product_id == product_id).delete()
    db.commit()
    return None
