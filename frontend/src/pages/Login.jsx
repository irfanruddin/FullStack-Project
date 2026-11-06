import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import AuthShell, { RoleSwitch } from "../components/AuthShell";
import { Field, PasswordInput, ErrorBox, NoticeBox } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState("customer");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const seller = role === "seller";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || !password) { setError("Enter your email or phone number and your password."); return; }
    setBusy(true);
    try {
      const d = await login("/auth/login", { identifier, password, role, remember_me: remember });
      if (d.user.role === "seller") {
        // Approved sellers see the dashboard. Pending or rejected sellers see their application status.
        navigate(d.seller_status === "approved" ? "/seller/dashboard" : "/seller/application", { replace: true });
      } else {
        navigate(location.state?.from || "/", { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title1={seller ? "Run your shop," : "Shop from small sellers,"}
      title2={seller ? "reach more customers" : "all in one place"}
      sub={seller ? "Log in to manage products, process orders and track your sales." : "Log in to track orders, save your wishlist and check out faster."}
      foot={seller ? "Product listing, order updates and sales reports" : "Cash on delivery, order tracking and approved sellers"}
    >
      <RoleSwitch role={role} setRole={setRole} />
      <h2 className="font-display text-4xl">{seller ? "Seller log in" : "Log in"}</h2>
      <p className="mt-2 mb-6 text-muted">Welcome back. Use your email or phone number.</p>
      <NoticeBox>{location.state?.notice}</NoticeBox>
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={submit} noValidate>
        <Field label="Email or phone number">
          <input className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
            placeholder={seller ? "shop@example.com" : "you@example.com"} autoComplete="username" />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <div className="mb-6 flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me logged in
          </label>
          <Link className="link" to="/forgot-password">Forgot password?</Link>
        </div>
        <button className="btn-gold w-full min-h-[50px]" disabled={busy}>{busy ? "Please wait..." : seller ? "Seller log in" : "Log in"}</button>
      </form>
      <hr className="my-6 border-line" />
      <p className="text-center text-sm text-muted mb-3">{seller ? "Want to sell on UrbanCart?" : "New to UrbanCart?"}</p>
      <Link to={seller ? "/seller/apply" : "/register"} className="btn-outline w-full min-h-[50px]">
        {seller ? "Apply to become a seller" : "Create your account"}
      </Link>
      {!seller && <p className="mt-5 text-center text-sm"><Link className="link" to="/seller/apply">Want to sell? Become a seller</Link></p>}
    </AuthShell>
  );
}
