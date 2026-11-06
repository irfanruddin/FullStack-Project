"""Request and response shapes. Later modules add their own schemas below."""
import re
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, field_validator

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _check_password(value: str) -> str:
    if len(value) < 8 or len(value) > 64:
        raise ValueError("Password must be 8 to 64 characters.")
    if not re.search(r"[A-Za-z]", value) or not re.search(r"[0-9]", value):
        raise ValueError("Password must contain a letter and a number.")
    return value


def _check_phone(value: str) -> str:
    value = value.strip()
    if not re.fullmatch(r"[0-9]{10}", value):
        raise ValueError("Phone number must be 10 digits.")
    return value


# ---------- Authentication ----------
class RegisterIn(BaseModel):
    name: str
    email: str
    phone: str
    password: str

    @field_validator("name")
    @classmethod
    def v_name(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Please enter your name.")
        return v

    @field_validator("email")
    @classmethod
    def v_email(cls, v):
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address.")
        return v

    @field_validator("phone")
    @classmethod
    def v_phone(cls, v):
        return _check_phone(v)

    @field_validator("password")
    @classmethod
    def v_password(cls, v):
        return _check_password(v)


class LoginIn(BaseModel):
    identifier: str                      # email or phone
    password: str
    role: Literal["customer", "seller"] = "customer"
    remember_me: bool = False


class AdminLoginIn(BaseModel):
    email: str
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class ForgotIn(BaseModel):
    identifier: str


class ResetIn(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def v_password(cls, v):
        return _check_password(v)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def v_password(cls, v):
        return _check_password(v)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    phone: str
    role: str
    status: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
    seller_status: Optional[str] = None   # pending, approved, rejected, blocked (sellers only)


class MeOut(BaseModel):
    user: UserOut
    seller_status: Optional[str] = None


class MessageOut(BaseModel):
    message: str


# ---------- Profile and addresses ----------
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def v_phone(cls, v):
        return None if v is None else _check_phone(v)


class AddressIn(BaseModel):
    full_name: str
    phone: str
    street: str
    city: str
    state: str
    pincode: str
    label: Literal["Home", "Work"] = "Home"
    is_default: bool = False

    @field_validator("phone")
    @classmethod
    def v_phone(cls, v):
        return _check_phone(v)

    @field_validator("pincode")
    @classmethod
    def v_pin(cls, v):
        v = v.strip()
        if not re.fullmatch(r"[0-9]{6}", v):
            raise ValueError("Pincode must be 6 digits.")
        return v

    @field_validator("full_name", "street", "city", "state")
    @classmethod
    def v_text(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("This field is required.")
        return v


class AddressOut(AddressIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Catalogue ----------
class ReviewIn(BaseModel):
    rating: int
    title: Optional[str] = None
    body: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def v_rating(cls, v):
        if v < 1 or v > 5:
            raise ValueError("Rating must be from 1 to 5.")
        return v

    @field_validator("title")
    @classmethod
    def v_title(cls, v):
        return v.strip()[:150] if v else None

    @field_validator("body")
    @classmethod
    def v_body(cls, v):
        return v.strip()[:2000] if v else None


# ---------- Cart, checkout and payment ----------
class CartAdd(BaseModel):
    product_id: int
    quantity: int = 1

    @field_validator("quantity")
    @classmethod
    def v_qty(cls, v):
        if v < 1 or v > 10:
            raise ValueError("Quantity must be from 1 to 10.")
        return v


class CartUpdate(BaseModel):
    quantity: int

    @field_validator("quantity")
    @classmethod
    def v_qty(cls, v):
        if v < 1 or v > 10:
            raise ValueError("Quantity must be from 1 to 10.")
        return v


class ValidateIn(BaseModel):
    address_id: Optional[int] = None


class PlaceOrderIn(BaseModel):
    address_id: int
    payment_method: Literal["cod", "online"]


class TestPayIn(BaseModel):
    ref: str
    method: Literal["card", "upi"] = "card"
    card_number: Optional[str] = None
    name: Optional[str] = None
    expiry: Optional[str] = None          # MM/YY
    cvv: Optional[str] = None
    upi_id: Optional[str] = None
