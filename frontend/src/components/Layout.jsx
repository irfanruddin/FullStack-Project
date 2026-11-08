import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, Navigate } from "react-router-dom";
import { api } from "../api";
import { useCart } from "../cartContext";
import { useAuth } from "../auth";
import LogoutConfirmModal from "./LogoutConfirmModal";

function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();
  const home =
    user?.role === "seller"
      ? "/seller/dashboard"
      : user?.role === "admin"
        ? "/admin"
        : "/account";
  return (
    <>
      <header className="bg-ink text-cream">
        <div className="mx-auto max-w-[1200px] flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
          <Link to="/" className="font-display text-3xl font-bold hover:text-gold transition-colors">
            UrbanCart
          </Link>
          <form
            className="flex-1 min-w-[240px]"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/search?q=${encodeURIComponent(e.target.q.value)}`);
            }}
          >
            <input
              name="q"
              className="w-full rounded-lg bg-card text-body px-5 min-h-[40px] text-sm outline-none"
              placeholder="Search products, categories and sellers"
            />
          </form>
          <nav className="flex items-center gap-6 text-sm font-medium">
            {user?.role === "seller" ? (
              <>
                <Link to="/seller/dashboard" className="header-nav-link">Seller workspace</Link>
                <button onClick={() => setShowLogoutModal(true)} className="header-nav-link">Logout</button>
              </>
            ) : (
              <>
                <Link to="/" className="header-nav-link">Home</Link>
                <Link to="/wishlist" className="header-nav-link">Wishlist</Link>
                <Link to="/cart" className="header-nav-link">Cart{count > 0 && <span className="ml-1 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-ink">{count}</span>}</Link>
                {user ? <>
                  <Link to={home} className="header-nav-link">{user.role === "customer" ? "My account" : "Dashboard"}</Link>
                  {user.role === "customer" && <Link to="/orders" className="header-nav-link">My orders</Link>}
                  <button onClick={() => setShowLogoutModal(true)} className="header-nav-link">Logout</button>
                </> : <Link to="/login" className="header-nav-link">Log in</Link>}
              </>
            )}
          </nav>
        </div>
      </header>
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false);
          logout();
        }}
      />
    </>
  );
}

const TICKER_CATEGORIES = [
  {
    displayName: "Mobiles & Tablets",
    parentName: "Electronics",
    subName: "Mobiles",
  },
  {
    displayName: "Electronics & Accessories",
    parentName: "Electronics",
  },
  {
    displayName: "Fashion & Apparel",
    parentName: "Fashion",
  },
  {
    displayName: "Home & Kitchen",
    parentName: "Home and kitchen",
  },
  {
    displayName: "Beauty",
    parentName: "Beauty",
  },
  {
    displayName: "Toys",
    parentName: "Toys",
  },
  {
    displayName: "Grocery & Daily Essentials",
    parentName: "Grocery",
  },
  {
    displayName: "Sports, Fitness & Outdoor",
    parentName: "Sports",
  },
  {
    displayName: "Books",
    parentName: "Books",
  },
];

function CategoryStrip() {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    api("/categories", { auth: false })
      .then((data) => {
        if (Array.isArray(data)) setCats(data);
      })
      .catch(() => {});
  }, []);

  const tickerItems = TICKER_CATEGORIES.map((item) => {
    const parent = cats.find(
      (c) => c.name.toLowerCase() === item.parentName.toLowerCase()
    );
    if (!parent) return null;

    if (item.subName) {
      const sub = parent.children?.find(
        (s) => s.name.toLowerCase() === item.subName.toLowerCase()
      );
      if (!sub) return null;
      return {
        displayName: item.displayName,
        to: `/category/${parent.id}?sub_id=${sub.id}`,
        id: `${parent.id}-sub-${sub.id}`,
      };
    }

    return {
      displayName: item.displayName,
      to: `/category/${parent.id}`,
      id: `${parent.id}`,
    };
  }).filter(Boolean);

  if (tickerItems.length === 0) {
    return (
      <div
        className="category-ticker-wrapper min-h-[46px]"
        aria-hidden="true"
      />
    );
  }

  const renderGroup = (keyPrefix, isClone = false) => (
    <div
      key={keyPrefix}
      className="category-ticker-group"
      aria-hidden={isClone ? "true" : undefined}
    >
      {tickerItems.map((item, index) => (
        <Link
          key={`${keyPrefix}-${item.id}-${index}`}
          to={item.to}
          tabIndex={isClone ? -1 : undefined}
          className="category-ticker-item"
        >
          <span>{item.displayName}</span>
          <span className="category-ticker-separator" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );

  return (
    <div
      className="category-ticker-wrapper"
      aria-label="Category navigation ticker"
      role="region"
    >
      <nav className="category-ticker-track" aria-label="Categories">
        {renderGroup("group-primary", false)}
        {renderGroup("group-clone-1", true)}
        {renderGroup("group-clone-2", true)}
        {renderGroup("group-clone-3", true)}
      </nav>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-ink text-[#CFC6AE] mt-16">
      <div className="mx-auto max-w-[1200px] flex flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm">
        <span className="font-display text-2xl font-bold text-cream">
          UrbanCart
        </span>
        <nav className="flex gap-6">
          <Link to="/about" className="hover:text-gold transition-colors">About</Link>
          <Link to="/help" className="hover:text-gold transition-colors">Help</Link>
          <Link to="/seller/apply" className="hover:text-gold transition-colors">Sell on UrbanCart</Link>
          <Link to="/terms" className="hover:text-gold transition-colors">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  // A seller who opens a customer-store URL is returned to the separate seller workspace.
  if (user?.role === "seller") return <Navigate to={user.seller_status === "approved" ? "/seller/dashboard" : "/seller/application"} replace />;
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Header />
      <CategoryStrip />
      <main className="flex-1 mx-auto w-full max-w-[1200px] px-6 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
