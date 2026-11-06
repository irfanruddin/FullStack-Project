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
          <Link to="/" className="font-display text-3xl font-bold">
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
                <Link to="/seller/dashboard">Seller workspace</Link>
                <button onClick={() => setShowLogoutModal(true)}>Logout</button>
              </>
            ) : (
              <>
                <Link to="/">Home</Link>
                <Link to="/wishlist">Wishlist</Link>
                <Link to="/cart">Cart{count > 0 && <span className="ml-1 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-ink">{count}</span>}</Link>
                {user ? <>
                  <Link to={home}>{user.role === "customer" ? "My account" : "Dashboard"}</Link>
                  {user.role === "customer" && <Link to="/orders">My orders</Link>}
                  <button onClick={() => setShowLogoutModal(true)}>Logout</button>
                </> : <Link to="/login">Log in</Link>}
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

function CategoryStrip() {
  const [cats, setCats] = useState([]);
  useEffect(() => {
    api("/categories", { auth: false })
      .then(setCats)
      .catch(() => {});
  }, []);
  return (
    <div className="bg-[#2A2A2A] text-cream">
      <nav className="mx-auto flex max-w-[1200px] flex-wrap gap-x-7 px-6 text-[15px]">
        <Link to="/products" className="py-3">
          All
        </Link>
        {cats.map((c) => (
          <Link key={c.id} to={`/category/${c.id}`} className="py-3">
            {c.name}
          </Link>
        ))}
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
          <Link to="/about">About</Link>
          <Link to="/help">Help</Link>
          <Link to="/seller/apply">Sell on UrbanCart</Link>
          <Link to="/terms">Terms</Link>
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
