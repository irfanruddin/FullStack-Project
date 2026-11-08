import { Route, Routes } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import Dashboard from "./Dashboard";
import Users from "./Users";
import Sellers from "./Sellers";
import SellerReview from "./SellerReview";
import Orders from "./Orders";
import OrderDetail from "./OrderDetail";
import Returns from "./Returns";
import Reports from "./Reports";

// Mounted at /admin/* in App.jsx. Every page inside is for admins only.
export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="sellers" element={<Sellers />} />
        <Route path="sellers/:id" element={<SellerReview />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="returns" element={<Returns />} />
        <Route path="reports" element={<Reports />} />
      </Route>
    </Routes>
  );
}
