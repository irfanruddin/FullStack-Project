import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import AuthShell from "../components/AuthShell";
import { Field, ErrorBox } from "../components/ui";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e?.preventDefault();
    setError("");
    if (!identifier.trim()) { setError("Enter your email or phone number."); return; }
    setBusy(true);
    try {
      await api("/auth/password/forgot", { method: "POST", body: { identifier }, auth: false });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title1="No problem," title2="we will help you back in" sub="Reset your password and get back to your orders and wishlist." foot="">
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gold text-3xl font-bold">✓</div>
          <h2 className="font-display text-4xl">Check your inbox</h2>
          <p className="mt-3 text-muted">We sent a reset link to {identifier}.</p>
          <p className="text-muted">It works once and stays valid for 30 minutes.</p>
          <Link to="/login" className="btn-gold w-full min-h-[50px] mt-8">Back to log in</Link>
          <div className="mt-5 flex justify-center gap-6 text-sm">
            <button className="link" onClick={send} disabled={busy}>Resend link</button>
            <button className="link" onClick={() => setSent(false)}>Use a different email</button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="font-display text-4xl">Reset your password</h2>
          <p className="mt-2 mb-6 text-muted">Enter the email or phone number you signed up with.</p>
          <ErrorBox>{error}</ErrorBox>
          <form onSubmit={send} noValidate>
            <Field label="Email or phone number"><input className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com" /></Field>
            <button className="btn-gold w-full min-h-[50px]" disabled={busy}>{busy ? "Please wait..." : "Send reset link"}</button>
          </form>
          <p className="mt-6 text-center text-sm"><Link className="link" to="/login">Back to log in</Link></p>
        </>
      )}
    </AuthShell>
  );
}
