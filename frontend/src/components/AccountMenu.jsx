import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";

const items = [
  ["/account", "Profile"],
  ["/account/addresses", "Saved addresses"],
  ["/orders", "My orders"],
  ["/wishlist", "Wishlist"],
];

export default function AccountMenu() {
  const { logout } = useAuth();
  return (
    <nav className="card p-3 flex flex-col gap-1 h-fit">
      {items.map(([to, label]) => (
        <NavLink key={to} to={to} end
          className={({ isActive }) => `rounded-lg px-4 py-3 text-[15px] ${isActive ? "bg-gold font-bold text-ink" : "text-body"}`}>
          {label}
        </NavLink>
      ))}
      <button onClick={logout} className="rounded-lg px-4 py-3 text-left text-[15px]">Log out</button>
    </nav>
  );
}
