"""Passwords, tokens and role checks."""
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .config import settings
from .database import get_db
from .models import User, Seller

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_token(user: User, kind: str, remember: bool = False) -> str:
    """kind is 'access' or 'refresh'."""
    if kind == "access":
        expires = timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    else:
        days = settings.REFRESH_TOKEN_DAYS_REMEMBER if remember else settings.REFRESH_TOKEN_DAYS
        expires = timedelta(days=days)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "type": kind,
        "exp": datetime.now(timezone.utc) + expires,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str, kind: str) -> dict:
    try:
        data = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired. Please log in again.")
    if data.get("type") != kind:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token.")
    return data


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please log in.")
    data = decode_token(creds.credentials, "access")
    user = db.get(User, int(data["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found.")
    if user.status == "blocked":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is blocked.")
    return user


def require_role(*roles: str):
    """Use as: user = Depends(require_role('admin'))"""
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this page.")
        return user
    return checker


def get_approved_seller(
    user: User = Depends(require_role("seller")),
    db: Session = Depends(get_db),
) -> Seller:
    """For seller pages that only approved sellers may open."""
    seller = db.query(Seller).filter(Seller.user_id == user.id).first()
    if seller is None or seller.status != "approved":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your seller account is not approved yet.")
    return seller


def get_optional_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
):
    """For public pages that show extra things to a logged-in user. Never raises."""
    if creds is None:
        return None
    try:
        data = decode_token(creds.credentials, "access")
    except HTTPException:
        return None
    user = db.get(User, int(data["sub"]))
    return user if user is not None and user.status != "blocked" else None
