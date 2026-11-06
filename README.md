# UrbanCart – Multi-Vendor E-Commerce Platform

UrbanCart is a full-stack, multi-vendor e-commerce web application designed to connect customers, sellers and administrators through a single online shopping platform.

The platform allows customers to explore products, manage shopping carts, place orders and track purchases. Sellers can manage their shops, products, inventory and customer orders. Administrators will have centralized control over users, sellers, products and overall platform activities.

The project is being developed using React, Tailwind CSS, FastAPI and MySQL.

---

## 1. Project Objectives

- Develop a centralized multi-vendor e-commerce platform.
- Provide a dedicated interface for customers, sellers and administrators.
- Allow sellers to manage their products and business activities independently.
- Provide customers with a convenient online shopping experience.
- Implement secure authentication and role-based access control.
- Provide administrators with tools to monitor and manage the platform.

---

## 2. User Roles

UrbanCart consists of three primary user roles:

| Role | Description |
|---|---|
| Customer | Browses products, manages carts, places orders and tracks purchases. |
| Seller | Manages shop information, products, inventory, orders and sales. |
| Admin | Manages platform users, seller approvals, products and overall operations. |

---

## 3. Main Modules and Features

### A. Customer Module

The Customer Module provides the shopping experience.

**Authentication and Account Management**
- Customer registration and login.
- Secure password authentication.
- Account management.
- Address management.

**Product Discovery**
- Browse available products.
- Explore product categories.
- View product details.
- Search and discover products.
- View product images and pricing.

**Shopping Cart and Wishlist**
- Add products to cart.
- Update product quantities.
- Remove products from cart.
- Manage wishlist items.

**Order Management**
- Place orders.
- Checkout and payment simulation.
- View order history.
- Track order status.
- Cancel eligible orders.
- Submit return requests.
- View refund status.

### B. Seller Module

The Seller Module provides an independent workspace for sellers.

**Seller Registration and Approval**
- Seller application.
- Shop registration.
- Application status tracking.
- Pending and rejected application states.
- Administrator approval workflow (Admin Module pending).

**Seller Dashboard**
- View shop statistics.
- Monitor products.
- View orders requiring processing.
- Monitor sales performance.

**Product Management**
- Add new products.
- Edit product information.
- Manage product images.
- Update product prices.
- Hide or manage products.
- Manage product inventory.

**Inventory Management**
- Update available stock.
- Monitor stock availability.
- Identify low-stock products.

**Order Management**
- View seller orders.
- View order details.
- Confirm orders.
- Update order status.
- Mark orders as shipped or delivered.

**Returns Management**
- View customer return requests.
- Approve or reject return requests.
- Manage return processing.

**Sales and Reports**
- View sales summaries.
- Monitor sales performance.
- Review order-related information.

**Shop Profile**
- Manage shop name.
- Update shop description.
- Manage shop category.
- Update pickup address and other shop details.

### C. Admin Module – Pending Development

The Admin Module is the remaining major development phase.

It will provide centralized control over the UrbanCart platform.

Planned features include:

**Admin Authentication**
- Dedicated administrator login.
- Role-based access.
- Protected administration routes.

**Dashboard**
- Total registered customers.
- Total registered sellers.
- Total products.
- Total orders.
- Sales and platform statistics.

**Seller Management**
- View seller applications.
- Approve seller applications.
- Reject seller applications.
- Manage existing sellers.
- Block or unblock sellers.

**Customer Management**
- View registered customers.
- Manage customer accounts.
- Block or unblock accounts.

**Product Management**
- View all listed products.
- Monitor product availability.
- Manage inappropriate or unavailable listings.

**Order Management**
- View platform orders.
- Monitor order statuses.
- Review order information.

**Reports and Analytics**
- Monitor overall platform performance.
- View sales reports.
- Analyze customer and seller activities.

*Note: These are planned Admin Module requirements. They should not be considered completed functionality.*

---

## 4. Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| React.js | Frontend user interface |
| Vite | Frontend development and build tool |
| Tailwind CSS | UI styling |
| React Router DOM | Client-side routing |
| JavaScript | Application functionality |

### Backend

| Technology | Purpose |
|---|---|
| Python | Backend programming language |
| FastAPI | REST API development |
| SQLAlchemy | Database ORM |
| Pydantic | Data validation |
| PyMySQL | MySQL database connectivity |
| JWT | Authentication |
| bcrypt | Password hashing |
| Uvicorn | ASGI server |

### Database

- MySQL
- MySQL Workbench
- SQLAlchemy ORM

### Development Tools

- Visual Studio Code
- Git
- GitHub
- Postman / Swagger UI
- MySQL Workbench

### Deployment

- Vercel – Planned frontend hosting.
- Backend hosting – To be finalized.
- Cloud database hosting – To be finalized.

---

## 5. System Architecture

UrbanCart follows a client-server architecture.

```text
                 URBANCART
                     |
          React + Tailwind Frontend
                     |
              React Router
                     |
          Role-Based User Interface
                     |
             REST API Requests
                     |
             FastAPI Backend
                     |
          Authentication & Security
                     |
              API Routers
                     |
              SQLAlchemy ORM
                     |
               MySQL Database
                     |
        --------------------------------
        |              |               |
     Customer        Seller           Admin
      Module         Module          Module
   Implemented    Implemented       Pending
```

---

## 6. Database Overview

The application uses MySQL with SQLAlchemy models.

The database includes entities for:

| Entity | Purpose |
|---|---|
| User | Stores customer, seller and admin accounts |
| Seller | Stores seller shop information and approval status |
| SellerDocument | Stores seller verification documents |
| Category | Stores product categories |
| Product | Stores product details and inventory |
| ProductImage | Stores product image references |
| Order | Stores order and delivery information |
| OrderItem | Stores individual items in an order |
| OrderStatusHistory | Maintains order status history |
| Payment | Stores payment information |
| ReturnRequest | Stores customer return requests |

Additional entities support addresses, cart and wishlist functionality.

Database tables are defined through SQLAlchemy models and can be created using the application's database initialization process.

---

## 7. Project Structure

```text
FullStack/
│
├── backend/
│   │
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── catalogue.py
│   │   │   ├── cart.py
│   │   │   ├── checkout.py
│   │   │   ├── orders.py
│   │   │   ├── wishlist.py
│   │   │   └── seller.py
│   │   │
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── emailer.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   └── services.py
│   │
│   ├── tests/
│   ├── requirements.txt
│   └── seed.py
│
├── frontend/
│   │
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── seller/
│   │   │   └── ...
│   │   │
│   │   ├── pages/
│   │   │   ├── seller/
│   │   │   └── ...
│   │   │
│   │   ├── App.jsx
│   │   ├── auth.jsx
│   │   ├── api.js
│   │   └── index.css
│   │
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── _Documents/
│   ├── BRD
│   ├── ER Diagrams
│   ├── Project Reports
│   └── UI References
│
├── .gitignore
└── README.md
```

---

## 8. Installation and Setup

### Prerequisites

Install the following:

- Python
- Node.js and npm
- MySQL Server
- MySQL Workbench
- Visual Studio Code
- Git

### Step 1: Clone the repository

```bash
git clone https://github.com/irfanruddin/FullStack-Project.git
```

```bash
cd FullStack-Project
```

### Step 2: Backend Setup

Navigate to the backend:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### Step 3: Database Configuration

Create a MySQL database:

```sql
CREATE DATABASE urbancart;
```

Configure the backend `.env` file with the appropriate database connection and security settings.

Example:

```env
DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/urbancart

SECRET_KEY=YOUR_SECRET_KEY

FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173

LOW_STOCK_LIMIT=5
UPLOAD_DIR=uploads
```

Replace the placeholder values with your own configuration.

The application uses SQLAlchemy models for database table initialization.

### Step 4: Start the Backend

From the backend directory:

```bash
python -m uvicorn app.main:app --reload
```

Backend development URL:

```text
http://127.0.0.1:8000
```

Swagger API documentation:

```text
http://127.0.0.1:8000/docs
```

### Step 5: Frontend Setup

Open another terminal and navigate to:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Frontend development URL:

```text
http://localhost:5173
```

### Step 6: Build Frontend

To create a production build:

```bash
npm run build
```

---

## 9. API Structure

The backend uses the `/api/v1` API prefix.

Main API areas include:

| API Module | Responsibility |
|---|---|
| Authentication | Registration, login and user authentication |
| Users | User account and address operations |
| Catalogue | Product and category discovery |
| Cart | Shopping cart operations |
| Checkout | Order creation and checkout |
| Orders | Order history, tracking, cancellation and returns |
| Wishlist | Wishlist operations |
| Seller | Seller dashboard and shop management |

Interactive API documentation is available through FastAPI Swagger UI at `/docs` when the backend is running.

---

## 10. Security

UrbanCart includes security-related functionality such as:

- JWT-based authentication.
- Password hashing using bcrypt.
- Role-based access control.
- Protected frontend routes.
- Seller ownership checks for seller operations.
- Environment-based configuration.
- Input validation using Pydantic.

Environment files and other sensitive configuration must not be committed to public repositories.

---

## 11. Current Development Status

| Module / Feature | Status |
|---|---|
| Customer Authentication | Completed |
| Customer Account Management | Implemented |
| Product Catalogue | Implemented |
| Shopping Cart | Implemented |
| Wishlist | Implemented |
| Checkout | Implemented |
| Order Management | Implemented |
| Return Requests | Implemented |
| Seller Authentication | Implemented |
| Seller Application | Implemented |
| Seller Dashboard | Implemented |
| Seller Product Management | Implemented |
| Seller Inventory Management | Implemented |
| Seller Order Management | Implemented |
| Seller Sales | Implemented |
| Seller Profile | Implemented |
| Admin Dashboard | Pending |
| Admin Seller Management | Pending |
| Admin Customer Management | Pending |
| Admin Product Management | Pending |
| Admin Reports | Pending |
| Production Deployment | In Progress |

---

## 12. Future Enhancements

The following enhancements may be considered in future development:

- Complete administrator dashboard.
- Advanced sales analytics.
- Enhanced reporting and filtering.
- Cloud-based image storage.
- Production email notification configuration.
- Production deployment and monitoring.
- Additional payment gateway integration.
- Improved platform security and performance.

---

## 13. Project Documentation

Supporting project documentation is maintained in the `_Documents` directory.

It includes:

- Business Requirements Document (BRD).
- High-Level Design (HLD).
- Entity Relationship Diagrams.
- Project reports.
- UI design references.

---

## 14. Contributors

**Project:** UrbanCart – Multi-Vendor E-Commerce Platform

**Developed as:** Academic / Full-Stack Development Project

The application is being developed collaboratively, with responsibilities distributed across authentication, product catalogue, seller management, order processing and administration.

---

## 15. License

This project is developed for academic and learning purposes.

---

**UrbanCart – Bringing Customers and Sellers Together.**
