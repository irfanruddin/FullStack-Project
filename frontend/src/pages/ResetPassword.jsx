import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import AuthShell from "../components/AuthShell";
import { Field, PasswordInput, ErrorBox } from "../components/ui";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (pw !== pw2) { setError("The two passwords do not match."); return; }
    setBusy(true);
    try {
      await api("/auth/password/reset", { method: "POST", body: { token, new_password: pw }, auth: false });
      navigate("/login", { state: { notice: "Your password has been changed. You can log in now." } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title1="Choose a new" title2="password" sub="Use at least 8 characters with a letter and a number." foot="">
      <h2 className="font-display text-4xl">Set a new password</h2>
      <p className="mt-2 mb-6 text-muted">This link works once.</p>
      <ErrorBox>{!token ? "This reset link is missing its token. Ask for a new link." : error}</ErrorBox>
      <form onSubmit={submit} noValidate>
        <Field label="New password"><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" autoComplete="new-password" /></Field>
        <Field label="Confirm new password"><PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat the password" autoComplete="new-password" /></Field>
        <button className="btn-gold w-full min-h-[50px]" disabled={busy || !token}>{busy ? "Please wait..." : "Change password"}</button>
      </form>
      <p className="mt-6 text-center text-sm"><Link className="link" to="/forgot-password">Need a new link?</Link></p>
    </AuthShell>
  );
}
