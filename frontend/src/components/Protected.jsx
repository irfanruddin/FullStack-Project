import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

// Only lets the listed roles in. Everyone else goes to the right login page.
export default function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const to = roles?.includes("admin") && !roles.includes("customer") ? "/admin/login" : "/login";
    return <Navigate to={to} state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
