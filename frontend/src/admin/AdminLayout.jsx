import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useModal } from "../components/ModalContext";

const items = [
  ["/admin", "Dashboard"],
  ["/admin/users", "Users"],
  ["/admin/sellers", "Sellers"],
  ["/admin/orders", "Orders"],
  ["/admin/returns", "Returns"],
  ["/admin/reports", "Reports"],
];

export default function AdminLayout() {
  const modal = useModal();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Fixed Sidebar */}
      <aside className="flex h-screen w-[260px] shrink-0 flex-col overflow-y-auto bg-ink px-4 py-8 text-cream">
        <p className="px-4 font-display text-2xl font-bold">UrbanCart</p>
        <p className="mb-8 px-4 text-xs text-[#CFC6AE]">Admin panel</p>

        <nav className="flex flex-1 flex-col gap-1">
          {items.map(([to, text]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              className={({ isActive }) =>
                `rounded-lg px-4 py-3 text-[15px] ${
                  isActive ? "bg-gold font-bold text-ink" : ""
                }`
              }
            >
              {text}
            </NavLink>
          ))}
        </nav>

        <button
          className="px-4 py-3 text-left text-sm text-[#CFC6AE] hover:text-white transition-colors"
          onClick={async () => {
            const ok = await modal.confirm({
              title: "Confirm Logout",
              message: "Are you sure you want to log out of the Admin portal?",
              confirmText: "Yes, Logout",
              type: "warning",
            });
            if (ok) {
              await logout();
              navigate("/admin/login");
            }
          }}
        >
          Log out
        </button>
      </aside>

      {/* Independently Scrollable Content */}
      <main className="h-screen min-w-0 flex-1 overflow-y-auto px-10 py-8">
        <Outlet />
      </main>
    </div>
  );
}
