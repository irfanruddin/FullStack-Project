import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import AuthShell from "../components/AuthShell";
import { Field, PasswordInput, ErrorBox } from "../components/ui";

export default function Register() {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function validate() {
    const e = {};
    if (f.name.trim().length < 2) e.name = "Please enter your name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = "Please enter a valid email address.";
    if (!/^[0-9]{10}$/.test(f.phone.trim())) e.phone = "Phone number must be 10 digits.";
    if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/[0-9]/.test(f.password)) e.password = "Use at least 8 characters with a letter and a number.";
    if (!agree) e.agree = "Please accept the Terms and Privacy Policy.";
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    setError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api("/auth/register", { method: "POST", body: f, auth: false });
      navigate("/login", { state: { notice: "Account created. You can log in now." } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title1="Join UrbanCart," title2="shop from small sellers"
      sub="Save your wishlist, track orders and check out faster."
      foot="Cash on delivery, order tracking and approved sellers">
      <h2 className="font-display text-4xl">Create your account</h2>
      <p className="mt-2 mb-6 text-muted">It takes less than a minute.</p>
      <ErrorBox>{error}</ErrorBox>
      <form onSubmit={submit} noValidate>
        <Field label="Full name" error={errors.name}><input className="input" value={f.name} onChange={set("name")} placeholder="Your name" /></Field>
        <Field label="Email" error={errors.email}><input className="input" value={f.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" /></Field>
        <Field label="Phone number" error={errors.phone}><input className="input" value={f.phone} onChange={set("phone")} placeholder="10-digit number" inputMode="numeric" /></Field>
        <Field label="Password" error={errors.password} hint="Use at least 8 characters with a letter and a number.">
          <PasswordInput value={f.password} onChange={set("password")} placeholder="Create a password" autoComplete="new-password" />
        </Field>
        <label className="flex items-center gap-2 text-sm mb-1"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I agree to the Terms and Privacy Policy</label>
        {errors.agree && <p className="text-xs text-red-700 mb-3">{errors.agree}</p>}
        <button className="btn-gold w-full min-h-[50px] mt-4" disabled={busy}>{busy ? "Please wait..." : "Create account"}</button>
      </form>
      <hr className="my-6 border-line" />
      <p className="text-center text-sm text-muted mb-3">Already have an account?</p>
      <Link to="/login" className="btn-outline w-full min-h-[50px]">Log in</Link>
    </AuthShell>
  );
}
