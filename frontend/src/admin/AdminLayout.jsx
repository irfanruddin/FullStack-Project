import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const items = [["/admin", "Dashboard"], ["/admin/users", "Users"], ["/admin/sellers", "Sellers"],
  ["/admin/orders", "Orders"], ["/admin/returns", "Returns"], ["/admin/reports", "Reports"]];

// Black sidebar + cream content, like the admin designs.
export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-[260px] shrink-0 flex-col bg-ink px-4 py-8 text-cream">
        <p className="px-4 font-display text-2xl font-bold">UrbanCart</p>
        <p className="mb-8 px-4 text-xs text-[#CFC6AE]">Admin panel</p>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(([to, text]) => (
            <NavLink key={to} to={to} end={to === "/admin"}
              className={({ isActive }) => `rounded-lg px-4 py-3 text-[15px] ${isActive ? "bg-gold font-bold text-ink" : ""}`}>{text}</NavLink>
          ))}
        </nav>
        <button className="px-4 py-3 text-left text-sm text-[#CFC6AE]" onClick={async () => { await logout(); navigate("/admin/login"); }}>Log out</button>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-8"><Outlet /></main>
    </div>
  );
}
