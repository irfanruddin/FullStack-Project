import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useCart } from "../cartContext";
import { useAuth } from "../auth";
import LogoutConfirmModal from "./LogoutConfirmModal";

function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlQ = searchParams.get("q") || "";
  const [searchVal, setSearchVal] = useState(urlQ);

  useEffect(() => {
    setSearchVal(urlQ);
  }, [urlQ]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchVal.trim();
    const next = new URLSearchParams();
    if (query) next.set("q", query);

    // Preserve existing category_id filter if present on products/search
    const existingCat = searchParams.get("category_id");
    if (existingCat) {
      next.set("category_id", existingCat);
    }

    const qs = next.toString();
    navigate(qs ? `/products?${qs}` : "/products");
  };

  const home =
    user?.role === "seller"
      ? "/seller/dashboard"
      : user?.role === "admin"
        ? "/admin"
        : "/account";
  return (
    <>
      <header className="sticky top-0 z-50 bg-ink text-cream shadow-md">
        <div className="mx-auto max-w-[1200px] flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
          <Link to="/" className="font-display text-3xl font-bold hover:text-gold transition-colors">
            UrbanCart
          </Link>
          <form
            className="relative flex-1 min-w-[240px]"
            onSubmit={handleSearchSubmit}
          >
            <input
              name="q"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-full rounded-lg bg-card text-body px-5 pr-10 min-h-[40px] text-sm outline-none"
              placeholder="Search products, categories and sellers"
            />
            {searchVal && (
              <button
                type="button"
                onClick={() => {
                  setSearchVal("");
                  const next = new URLSearchParams(searchParams);
                  next.delete("q");
                  next.delete("page");
                  const qs = next.toString();
                  navigate(qs ? `/products?${qs}` : "/products");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-lg px-1 font-bold leading-none"
                title="Clear search"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
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
    <footer className="bg-ink text-cream mt-16 border-t border-[#2A2A2A]">
      <div className="mx-auto max-w-[1200px] flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-4 text-sm">
        <Link to="/" className="font-display text-3xl font-bold text-cream hover:text-gold transition-colors">
          UrbanCart
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link to="/about" className="header-nav-link">About</Link>
          <Link to="/help" className="header-nav-link">Help</Link>
          <Link to="/seller/apply" className="header-nav-link">Sell on UrbanCart</Link>
          <Link to="/terms" className="header-nav-link">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  if (loading) return null;
  // A seller who opens a customer-store URL is returned to the separate seller workspace.
  if (user?.role === "seller") return <Navigate to={user.seller_status === "approved" ? "/seller/dashboard" : "/seller/application"} replace />;
  return (
    <div className="min-h-screen flex flex-col overflow-x-clip">
      <Header />
      {isHomePage && <CategoryStrip />}
      <main className="flex-1 mx-auto w-full max-w-[1200px] px-6 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
