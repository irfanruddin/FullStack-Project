"""All settings in one place. Values come from the .env file."""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/urbancart")
    if DATABASE_URL.startswith("mysql://"):
        DATABASE_URL = DATABASE_URL.replace(
        "mysql://", "mysql+pymysql://", 1
    )
    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "30"))
    REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "1"))
    REFRESH_TOKEN_DAYS_REMEMBER = int(os.getenv("REFRESH_TOKEN_DAYS_REMEMBER", "30"))
    RESET_TOKEN_MINUTES = int(os.getenv("RESET_TOKEN_MINUTES", "30"))

    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")]

    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM = os.getenv("SMTP_FROM", "UrbanCart <no-reply@urbancart.local>")

    # Fixed platform values (the admin Settings screen is out of scope)
    TAX_PERCENT = float(os.getenv("TAX_PERCENT", "5"))
    DELIVERY_CHARGE = float(os.getenv("DELIVERY_CHARGE", "40"))
    FREE_DELIVERY_ABOVE = float(os.getenv("FREE_DELIVERY_ABOVE", "500"))
    LOW_STOCK_LIMIT = int(os.getenv("LOW_STOCK_LIMIT", "5"))
    RETURN_WINDOW_DAYS = int(os.getenv("RETURN_WINDOW_DAYS", "5"))
    SHIP_BACK_DAYS = int(os.getenv("SHIP_BACK_DAYS", "5"))

    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


settings = Settings()
