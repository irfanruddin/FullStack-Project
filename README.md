# UrbanCart

Multi-seller e-commerce web app. React + Tailwind CSS (frontend), FastAPI (backend), MySQL (database).
Built stage by stage from the BRD. **Done so far: stage 1 (foundation, authentication, profile), stage 2 (catalogue, search, reviews, wishlist) and stage 3 (cart, checkout, test payment, invoice).**

## Run it

### 1. Database
Create an empty MySQL database:
```sql
CREATE DATABASE urbancart CHARACTER SET utf8mb4;
```

### 2. Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows   (Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # Mac/Linux: cp .env.example .env   then edit DATABASE_URL and SECRET_KEY
python seed.py                  # creates the tables, the category list, an admin, a customer, a demo seller with 38 products and some reviews
                                # (safe to run again; it only adds what is missing)
uvicorn app.main:app --reload --port 8000
```
API docs open at http://localhost:8000/docs

### 3. Frontend
```bash
cd frontend
npm install
copy .env.example .env          # Mac/Linux: cp .env.example .env
npm run dev
```
Open http://localhost:5173

### Test logins (created by seed.py)
| Role | Login | Password |
|---|---|---|
| Admin (page: /admin/login) | admin@urbancart.local | Admin@123 |
| Customer | customer@urbancart.local | Customer@123 |
| Seller (demo shop "Urban Basics", approved) | seller@urbancart.local | Seller@123 |

The seller panel itself is built in a later stage; the seller's products already show in the shop.

Emails (welcome, password reset) are printed in the backend console until you fill in the SMTP values in `.env`.

### Tests
```bash
cd backend
pytest
```

## What stage 1 contains
- **Database:** every table for the whole project is already in `backend/app/models.py`.
- **Backend:** all 16 authentication and profile endpoints (register, login, admin login, logout, me, refresh, forgot, reset and change password, profile, addresses), JWT, bcrypt, role checks (`require_role`, `get_approved_seller`), and the email helper.
- **Frontend:** Tailwind set up with the black, gold and cream theme, API client with automatic token refresh, login (Customer/Seller switch), sign up, forgot and reset password, my account, saved addresses, add and edit address, admin login, header and footer.
- Pages that later stages build show a "Coming in a later stage" message.

## What stage 2 added
- **Backend:** `GET /home`, `/categories`, `/products` (filters, search, sort, pages), `/products/{id}`, `/products/{id}/reviews` (list and write), and the wishlist (list, add, remove). Only active products of approved, unblocked sellers are shown. A review needs a delivered order of that product, once per customer.
- **Frontend:** home page with the full-width banner (back and forward buttons, dots, changes every 10 seconds, pauses on hover), four offer cards, categories, product rows; category page, search results and "all products" (filters in the URL), product page with reviews, write-a-review page, wishlist page with its empty state, and a category menu in the header.
- Product pictures: the seller panel (later stage) uploads them. Until then cards show a coloured block.

## What stage 3 added
- **Backend (11 endpoints):** cart (`GET /cart`, `POST /cart/items`, `PUT` and `DELETE /cart/items/{id}`, `POST /cart/items/{id}/move-to-wishlist`), wishlist moves (`POST /wishlist/{product_id}/move-to-cart`, `POST /wishlist/move-all-to-cart`), checkout (`POST /checkout/validate`, `POST /orders`, `POST /payments/test-pay`, `GET /orders/{order_id}/invoice`).
- **Frontend:** cart page and empty cart, checkout (address choice, payment choice, review items, summary, out-of-stock alert), online payment page and the "Payment failed" page, order confirmed page with invoice download, "Move all to cart" on the wishlist, cart count in the header.
- **No database change** from stage 2, so you do not need to recreate the database.
- Files: `backend/app/services.py` (pricing, stock, order creation), `routers/cart.py`, `routers/checkout.py`, `tests/test_cart_checkout.py` (7 tests).

## How checkout works (stage 3)
1. **Cart rules:** only active products of approved sellers can be added; at most 10 of one product, never more than the stock; an out-of-stock product is refused.
2. **Totals:** tax is 5% of the order subtotal. Delivery is 40, free when the order subtotal is 500 or more. Both are in `config.py`.
3. **One order per seller:** a cart with items from two sellers becomes two orders (`UC1A2B3C-1`, `UC1A2B3C-2`), and each gets its own delivery charge.
4. **Cash on delivery:** the orders are placed at once, the stock goes down, the cart is emptied and a confirmation email is sent.
5. **Online (test) payment:** the orders are first saved as `pending_payment` and **the stock is not touched**. The customer pays on the test payment page. On success the stock is checked again, reduced, and the orders become `placed`. If the payment fails nothing is placed, and the customer can try again or switch to Cash on Delivery.
6. **Test payment rules:** a card number ending in **0000** fails, a UPI id containing **fail** fails, anything valid-looking succeeds. No real money, no real gateway.
7. **Stock check:** if an item sold out while checking out, the order is refused with the item names (409) and the checkout page shows the red alert with "Remove item" and "Back to cart".
8. **Invoice:** a printable HTML file (open it and choose Print, then Save as PDF).
9. For later stages: orders with status `pending_payment` are internal and must **not** be shown in order lists, sales or reports.

## Choices in stage 2
- "Best deals" became **Top rated**, because discounts are a future enhancement in the BRD.
- The size and colour pickers and the delivery pincode check from the designs are **not built**: no requirement or table behind them yet.

## Decisions made while building (change if you disagree)
1. **One order per seller.** A cart with items from several sellers becomes several orders (the open point in the BRD). The order confirmation page then shows several order numbers.
2. **Fixed values** in `backend/app/config.py`: tax 5%, delivery charge 40 (free above 500), low stock at 5 units, return window 5 days, 5 days to ship a returned item back. Change them in `.env`.
3. **Tokens:** access token 30 minutes; refresh token 1 day, or 30 days when "Keep me logged in" is ticked.
4. **Logout** is handled in the browser (tokens are deleted). The endpoint exists so a block-list can be added later.
5. **Categories** come from `seed.py` (the admin category screens are out of scope).

## Next stages
2. ~~Catalogue~~ done
3. ~~Cart, checkout and test payment~~ done
4. Orders (list, tracking), cancellation, returns and refunds
5. Seller: application, dashboard, products, orders, sales, profile
6. Admin: dashboard, users, sellers, orders, returns, reports
7. Emails for every status change, polish, final testing

## Folder map
```
backend/app/models.py      all tables
backend/app/security.py    passwords, tokens, role checks
backend/app/routers/       one file per module (auth, users, ...)
backend/app/schemas.py     request and response shapes
frontend/src/api.js        talks to the backend, refreshes tokens
frontend/src/auth.jsx      who is logged in
frontend/src/pages/        one file per page
frontend/src/components/   header, footer, shared inputs
```
