"""Authentication: register, login, logout, current user, refresh, password reset and change."""
import hashlib
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..emailer import send_email
from ..models import User, Seller, PasswordResetToken
from ..schemas import (RegisterIn, LoginIn, AdminLoginIn, RefreshIn, ForgotIn, ResetIn,
                       ChangePasswordIn, TokenOut, MeOut, MessageOut, UserOut)
from ..security import (hash_password, verify_password, create_token, decode_token,
                        get_current_user)

router = APIRouter(prefix="/auth", tags=["Authentication"])

BAD_LOGIN = "Invalid login details."


def seller_status_of(user: User, db: Session):
    if user.role != "seller":
        return None
    seller = db.query(Seller).filter(Seller.user_id == user.id).first()
    return seller.status if seller else None


def token_response(user: User, db: Session, remember: bool = False) -> TokenOut:
    return TokenOut(
        access_token=create_token(user, "access"),
        refresh_token=create_token(user, "refresh", remember),
        user=UserOut.model_validate(user),
        seller_status=seller_status_of(user, db),
    )


def find_by_identifier(db: Session, identifier: str):
    ident = identifier.strip().lower()
    return db.query(User).filter(or_(User.email == ident, User.phone == identifier.strip())).first()


@router.post("/register", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    """Customer sign up. Email and phone are unique across all roles."""
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    if db.query(User).filter(User.phone == body.phone).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this phone number already exists.")
    user = User(name=body.name, email=body.email, phone=body.phone,
                password_hash=hash_password(body.password), role="customer")
    db.add(user)
    db.commit()
    send_email(user.email, "Welcome to UrbanCart",
               f"Hi {user.name},\n\nYour UrbanCart account is ready. You can log in now.\n\nUrbanCart")
    return MessageOut(message="Account created. You can log in now.")


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    """Customer and seller login. The chosen role must match the account."""
    user = find_by_identifier(db, body.identifier)
    # Same message for every failure so nobody can tell which part was wrong
    if user is None or user.role != body.role or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, BAD_LOGIN)
    if user.status == "blocked":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is blocked.")
    if seller_status_of(user, db) == "blocked":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your seller account is blocked.")
    return token_response(user, db, body.remember_me)


@router.post("/admin/login", response_model=TokenOut)
def admin_login(body: AdminLoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if user is None or user.role != "admin" or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password. Try again.")
    if user.status == "blocked":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is blocked.")
    return token_response(user, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(user: User = Depends(get_current_user)):
    """Tokens are stateless, so the browser deletes them. This endpoint exists so the
    frontend has one place to call, and to add a token block-list later if needed."""
    return None


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return MeOut(user=UserOut.model_validate(user), seller_status=seller_status_of(user, db))


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    data = decode_token(body.refresh_token, "refresh")
    user = db.get(User, int(data["sub"]))
    if user is None or user.status == "blocked":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please log in again.")
    return TokenOut(
        access_token=create_token(user, "access"),
        refresh_token=body.refresh_token,
        user=UserOut.model_validate(user),
        seller_status=seller_status_of(user, db),
    )


@router.post("/password/forgot", response_model=MessageOut)
def forgot_password(body: ForgotIn, db: Session = Depends(get_db)):
    """Always gives the same reply, whether or not the account exists. Also used by Resend link."""
    reply = MessageOut(message="If an account exists, a reset link has been sent.")
    user = find_by_identifier(db, body.identifier)
    if user is None or user.status == "blocked":
        return reply
    # A new link makes every older link stop working
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id,
                                        PasswordResetToken.used == False).update({"used": True})  # noqa: E712
    raw = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=hashlib.sha256(raw.encode()).hexdigest(),
        expires_at=datetime.utcnow() + timedelta(minutes=settings.RESET_TOKEN_MINUTES),
    ))
    db.commit()
    link = f"{settings.FRONTEND_URL}/reset-password?token={raw}"
    send_email(user.email, "Reset your UrbanCart password",
               f"Hi {user.name},\n\nUse this link to set a new password. It works once and expires "
               f"in {settings.RESET_TOKEN_MINUTES} minutes:\n\n{link}\n\nIf you did not ask for this, ignore this email.")
    return reply


@router.post("/password/reset", response_model=MessageOut)
def reset_password(body: ResetIn, db: Session = Depends(get_db)):
    token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == hashlib.sha256(body.token.encode()).hexdigest()).first()
    if token is None or token.used or token.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired.")
    user = db.get(User, token.user_id)
    user.password_hash = hash_password(body.new_password)
    token.used = True
    db.commit()
    return MessageOut(message="Your password has been changed. You can log in now.")


@router.post("/password/change", response_model=MessageOut)
def change_password(body: ChangePasswordIn, user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is wrong.")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return MessageOut(message="Password changed.")
