import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Field, PasswordInput, ErrorBox } from "../components/ui";

// Separate from the public login. Not linked from anywhere on the shop.
export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login("/auth/admin/login", { email, password });
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="bg-ink text-cream px-8 py-5 flex justify-between items-center">
        <span className="font-display text-3xl font-bold">UrbanCart</span>
        <span className="text-sm text-[#CFC6AE]">Admin</span>
      </div>
      <div className="mx-auto mt-16 w-full max-w-[440px] card p-8">
        <h1 className="font-display text-3xl">Admin sign in</h1>
        <p className="mt-1 mb-6 text-sm text-muted">For UrbanCart administrators only.</p>
        <ErrorBox>{error}</ErrorBox>
        <form onSubmit={submit} noValidate>
          <Field label="Email"><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" /></Field>
          <Field label="Password"><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <button className="btn-gold w-full min-h-[50px] mt-2" disabled={busy}>{busy ? "Please wait..." : "Sign in"}</button>
        </form>
      </div>
      <p className="mt-6 text-center text-sm text-muted">Not an administrator? <Link className="link" to="/login">Go to the customer log in</Link></p>
    </div>
  );
}
