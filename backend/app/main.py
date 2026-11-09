import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config import settings
from .database import Base, engine
from . import models  # noqa: F401  (registers every table)
from .routers import auth, users, catalogue, wishlist, cart, checkout, orders, seller, admin

app = FastAPI(title="UrbanCart API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(catalogue.router, prefix=PREFIX)
app.include_router(wishlist.router, prefix=PREFIX)
app.include_router(cart.router, prefix=PREFIX)
app.include_router(checkout.router, prefix=PREFIX)
app.include_router(orders.router, prefix=PREFIX)
app.include_router(seller.router, prefix=PREFIX)
app.include_router(admin.router, prefix=PREFIX)

# Health Check Endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"}
