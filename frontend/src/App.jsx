import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Protected from "./components/Protected";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminLogin from "./pages/AdminLogin";
import Account from "./pages/Account";
import Addresses from "./pages/Addresses";
import AddressForm from "./pages/AddressForm";
import Category from "./pages/Category";
import Search from "./pages/Search";
import Product from "./pages/Product";
import WriteReview from "./pages/WriteReview";
import Wishlist from "./pages/Wishlist";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import OrderConfirmed from "./pages/OrderConfirmed";
import Orders from "./pages/Orders";
import ComingSoon from "./pages/ComingSoon";
import SellerDashboard from "./pages/seller/SellerDashboard";
import SellerLayout from "./components/seller/SellerLayout";
import SellerApplication from "./pages/seller/SellerApplication";
import SellerApply from "./pages/seller/SellerApply";
import AdminApp from "./admin/AdminApp";

const customer = ["customer"];

export default function App() {
  return (
    <Routes>
      {/* Pages without the shop header */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin/*"
        element={
          <Protected roles={["admin"]}>
            <AdminApp />
          </Protected>
        }
      />

      {/* Seller workspace has its own layout, separate from the customer storefront. */}
      <Route path="/seller/apply" element={<SellerApply />} />
      <Route
        path="/seller/application"
        element={
          <Protected roles={["seller"]}>
            <SellerApplication />
          </Protected>
        }
      />
      <Route
        path="/seller"
        element={
          <Protected roles={["seller"]}>
            <SellerLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SellerDashboard />} />
        <Route path="products" element={<SellerDashboard />} />
        <Route path="orders" element={<SellerDashboard />} />
        <Route path="sales" element={<SellerDashboard />} />
        <Route path="profile" element={<SellerDashboard />} />
      </Route>

      {/* Customer pages with header and footer */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route
          path="/account"
          element={
            <Protected roles={customer}>
              <Account />
            </Protected>
          }
        />
        <Route
          path="/account/addresses"
          element={
            <Protected roles={customer}>
              <Addresses />
            </Protected>
          }
        />
        <Route
          path="/account/addresses/new"
          element={
            <Protected roles={customer}>
              <AddressForm />
            </Protected>
          }
        />
        <Route
          path="/account/addresses/:id/edit"
          element={
            <Protected roles={customer}>
              <AddressForm />
            </Protected>
          }
        />

        <Route path="/products" element={<Search />} />
        <Route path="/search" element={<Search />} />
        <Route path="/category/:id" element={<Category />} />
        <Route path="/products/:id" element={<Product />} />
        <Route
          path="/products/:id/review"
          element={
            <Protected roles={customer}>
              <WriteReview />
            </Protected>
          }
        />
        <Route
          path="/wishlist"
          element={
            <Protected roles={customer}>
              <Wishlist />
            </Protected>
          }
        />

        <Route
          path="/cart"
          element={
            <Protected roles={customer}>
              <Cart />
            </Protected>
          }
        />
        <Route
          path="/checkout"
          element={
            <Protected roles={customer}>
              <Checkout />
            </Protected>
          }
        />
        <Route
          path="/payment"
          element={
            <Protected roles={customer}>
              <Payment />
            </Protected>
          }
        />
        <Route
          path="/order-confirmed"
          element={
            <Protected roles={customer}>
              <OrderConfirmed />
            </Protected>
          }
        />
        <Route
          path="/orders"
          element={
            <Protected roles={customer}>
              <Orders />
            </Protected>
          }
        />
        <Route path="/about" element={<ComingSoon />} />
        <Route path="/help" element={<ComingSoon />} />
        <Route path="/terms" element={<ComingSoon />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
