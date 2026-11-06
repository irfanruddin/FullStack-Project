"""Run once after the database exists:  python seed.py
Creates the tables, the fixed category list, one admin and one test customer."""
from app.database import Base, engine, SessionLocal
from app import models
from app.security import hash_password

CATEGORIES = {
    "Fashion": ["Men", "Women", "Kids", "Footwear", "Accessories"],
    "Electronics": ["Mobiles", "Audio", "Laptops", "Accessories"],
    "Home and kitchen": ["Cookware", "Decor", "Storage", "Lighting"],
    "Books": ["Fiction", "Study guides", "Comics", "Stationery"],
    "Sports": ["Fitness", "Cycling", "Outdoor", "Footwear"],
    "Beauty": ["Skincare", "Haircare", "Makeup", "Fragrance"],
    "Toys": ["Puzzles", "Board games", "Soft toys", "Learning"],
    "Grocery": ["Staples", "Snacks", "Beverages", "Fresh"],
}


# (parent category, sub-category, name, price in rupees, stock)
DEMO_PRODUCTS = [
    ("Fashion", "Men", "Cotton kurta", 799, 40), ("Fashion", "Men", "Linen shirt", 1099, 25),
    ("Fashion", "Men", "Denim jacket", 2299, 12), ("Fashion", "Women", "Printed scarf", 499, 60),
    ("Fashion", "Women", "Cotton kurti", 899, 30), ("Fashion", "Footwear", "Canvas sneakers", 1499, 3),
    ("Fashion", "Footwear", "Leather sandals", 999, 0), ("Fashion", "Accessories", "Leather wallet", 699, 50),
    ("Fashion", "Accessories", "Canvas backpack", 1299, 20),
    ("Electronics", "Audio", "Wireless earbuds", 1999, 35), ("Electronics", "Audio", "Bluetooth speaker", 2499, 18),
    ("Electronics", "Mobiles", "Phone case", 299, 100), ("Electronics", "Mobiles", "Fast charger 25W", 899, 45),
    ("Electronics", "Laptops", "Laptop sleeve", 799, 22), ("Electronics", "Laptops", "USB-C hub", 1599, 15),
    ("Home and kitchen", "Cookware", "Steel water bottle", 549, 80), ("Home and kitchen", "Cookware", "Non-stick pan", 1299, 28),
    ("Home and kitchen", "Lighting", "Study desk lamp", 899, 4), ("Home and kitchen", "Lighting", "LED strip lights", 699, 33),
    ("Home and kitchen", "Storage", "Storage box set", 799, 26),
    ("Books", "Fiction", "Mystery novel", 349, 70), ("Books", "Fiction", "Short stories collection", 299, 55),
    ("Books", "Study guides", "Python programming guide", 599, 40), ("Books", "Study guides", "SQL made simple", 499, 38),
    ("Books", "Stationery", "Notebook pack of 5", 249, 120), ("Books", "Stationery", "Gel pens set", 149, 150),
    ("Sports", "Fitness", "Yoga mat", 899, 30), ("Sports", "Fitness", "Resistance bands", 599, 45),
    ("Sports", "Cycling", "Cycling gloves", 499, 20),
    ("Beauty", "Skincare", "Face wash", 249, 90), ("Beauty", "Skincare", "Moisturiser", 399, 60),
    ("Beauty", "Haircare", "Herbal shampoo", 329, 75),
    ("Toys", "Puzzles", "Jigsaw puzzle 500 pieces", 449, 35), ("Toys", "Puzzles", "Wooden puzzle", 299, 40),
    ("Toys", "Board games", "Family board game", 899, 18),
    ("Grocery", "Snacks", "Roasted almonds", 349, 65), ("Grocery", "Snacks", "Muesli pack", 299, 50),
    ("Grocery", "Staples", "Basmati rice 5kg", 699, 40),
]
REVIEWS = [(5, "Great quality", "Exactly as described and arrived on time."), (4, "Good value", "Works well for the price."),
           (5, "Happy with it", "Would buy again."), (3, "Okay", "Fine, but could be better."), (4, "Nice", "Does the job.")]


def seed_demo(db):
    """Demo seller, products and a few reviews so the shop is not empty. Safe to run again."""
    if db.query(models.User).filter_by(email="seller@urbancart.local").first():
        return
    seller_user = models.User(name="Demo Seller", email="seller@urbancart.local", phone="9000000002",
                              password_hash=hash_password("Seller@123"), role="seller")
    db.add(seller_user)
    db.flush()
    seller = models.Seller(user_id=seller_user.id, shop_name="Urban Basics", description="Everyday products, fair prices.",
                           category="General", pickup_address="12 MG Road", city="Bengaluru", pincode="560001",
                           status="approved")
    db.add(seller)
    reviewers = []
    for i in range(1, 4):
        u = models.User(name=f"Reviewer {i}", email=f"reviewer{i}@urbancart.local", phone=f"900000010{i}",
                        password_hash=hash_password("Reviewer@123"), role="customer")
        db.add(u)
        reviewers.append(u)
    db.flush()
    parents = {c.name: c for c in db.query(models.Category).filter(models.Category.parent_id == None).all()}  # noqa: E711
    products = []
    for parent, sub, name, price, stock in DEMO_PRODUCTS:
        cat = next(c for c in parents[parent].children if c.name == sub)
        p = models.Product(seller_id=seller.id, category_id=cat.id, name=name, price=price, stock=stock,
                           description=f"{name} from Urban Basics. Good quality at a fair price.")
        db.add(p)
        products.append(p)
    db.flush()
    for i, p in enumerate(products[:15]):
        for j, rv in enumerate(reviewers[: 1 + i % 3]):
            rating, title, body = REVIEWS[(i + j) % len(REVIEWS)]
            db.add(models.Review(product_id=p.id, user_id=rv.id, rating=rating, title=title, body=body))


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if db.query(models.Category).count() == 0:
        for name, subs in CATEGORIES.items():
            parent = models.Category(name=name)
            db.add(parent)
            db.flush()
            for sub in subs:
                db.add(models.Category(name=sub, parent_id=parent.id))
    if not db.query(models.User).filter_by(email="admin@urbancart.local").first():
        db.add(models.User(name="Admin", email="admin@urbancart.local", phone="9000000000",
                           password_hash=hash_password("Admin@123"), role="admin"))
    if not db.query(models.User).filter_by(email="customer@urbancart.local").first():
        db.add(models.User(name="Test Customer", email="customer@urbancart.local", phone="9000000001",
                           password_hash=hash_password("Customer@123"), role="customer"))
    db.flush()
    seed_demo(db)
    db.commit()
    db.close()
    print("Done. Admin: admin@urbancart.local / Admin@123   Customer: customer@urbancart.local / Customer@123   Seller: seller@urbancart.local / Seller@123")


if __name__ == "__main__":
    main()
