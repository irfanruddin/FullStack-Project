"""Profile and saved addresses (logged-in users)."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Address
from ..schemas import UserOut, ProfileUpdate, AddressIn, AddressOut
from ..security import get_current_user

router = APIRouter(prefix="/users/me", tags=["Profile and addresses"])


@router.get("", response_model=UserOut)
def get_profile(user: User = Depends(get_current_user)):
    return user


@router.put("", response_model=UserOut)
def update_profile(body: ProfileUpdate, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    if body.name is not None:
        if len(body.name.strip()) < 2:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please enter your name.")
        user.name = body.name.strip()
    if body.phone is not None and body.phone != user.phone:
        if db.query(User).filter(User.phone == body.phone, User.id != user.id).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "This phone number is already used.")
        user.phone = body.phone
    db.commit()
    db.refresh(user)
    return user


def _own_address(db: Session, user: User, address_id: int) -> Address:
    address = db.query(Address).filter(Address.id == address_id, Address.user_id == user.id).first()
    if address is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Address not found.")
    return address


def _clear_default(db: Session, user: User):
    db.query(Address).filter(Address.user_id == user.id).update({"is_default": False})


@router.get("/addresses", response_model=List[AddressOut])
def list_addresses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (db.query(Address).filter(Address.user_id == user.id)
            .order_by(Address.is_default.desc(), Address.id).all())


@router.post("/addresses", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
def add_address(body: AddressIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    first = db.query(Address).filter(Address.user_id == user.id).count() == 0
    make_default = body.is_default or first          # the first address is the default
    if make_default:
        _clear_default(db, user)
    address = Address(user_id=user.id, **{**body.model_dump(), "is_default": make_default})
    db.add(address)
    db.commit()
    db.refresh(address)
    return address


@router.put("/addresses/{address_id}", response_model=AddressOut)
def edit_address(address_id: int, body: AddressIn, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    address = _own_address(db, user, address_id)
    if body.is_default:
        _clear_default(db, user)
    for key, value in body.model_dump().items():
        setattr(address, key, value)
    db.commit()
    db.refresh(address)
    return address


@router.delete("/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(address_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    address = _own_address(db, user, address_id)
    was_default = address.is_default
    db.delete(address)
    db.commit()
    if was_default:                                   # promote another address if one is left
        other = db.query(Address).filter(Address.user_id == user.id).first()
        if other:
            other.is_default = True
            db.commit()
    return None


@router.put("/addresses/{address_id}/default", response_model=AddressOut)
def set_default_address(address_id: int, user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    address = _own_address(db, user, address_id)
    _clear_default(db, user)
    address.is_default = True
    db.commit()
    db.refresh(address)
    return address
