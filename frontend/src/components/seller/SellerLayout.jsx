import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import LogoutConfirmModal from "../LogoutConfirmModal";
import { useState } from "react";

const links = [
  ["Dashboard", "/seller/dashboard", "▦"],
  ["Products", "/seller/products", "□"],
  ["Orders", "/seller/orders", "▤"],
  ["Sales", "/seller/sales", "▥"],
  ["Profile", "/seller/profile", "◉"],
];

export default function SellerLayout() {
  const { user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const navigate = useNavigate();
  return <div className="seller-shell">
    <aside className="seller-sidebar">
      <button className="seller-brand" onClick={() => navigate("/seller/dashboard")}>UrbanCart<span>Seller panel</span></button>
      <nav className="seller-nav" aria-label="Seller navigation">
        {links.map(([label, to, icon]) => <NavLink key={to} to={to} className={({isActive}) => `seller-nav-link ${isActive ? "active" : ""}`}><span aria-hidden="true">{icon}</span>{label}</NavLink>)}
      </nav>
      <div className="seller-sidebar-bottom">
        <div className="seller-user"><b>{user?.name || "Seller"}</b><span>{user?.email}</span></div>
        <button className="seller-logout" onClick={() => setConfirmLogout(true)}>Log out</button>
        <button className="seller-store-link" onClick={() => navigate("/")}>View customer store ↗</button>
      </div>
    </aside>
    <div className="seller-main-wrap">
      <header className="seller-topbar"><span>Seller workspace</span><span className="seller-topbar-name">{user?.name || "Seller"}</span></header>
      <main className="seller-main"><Outlet /></main>
    </div>
    <LogoutConfirmModal isOpen={confirmLogout} onCancel={() => setConfirmLogout(false)} onConfirm={() => { setConfirmLogout(false); logout(); navigate("/login", {replace:true}); }} />
  </div>;
}
