import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import AccountMenu from "../components/AccountMenu";
import { Field, PasswordInput, ErrorBox, NoticeBox } from "../components/ui";

export default function Account() {
  const { user, reload } = useAuth();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  async function saveProfile(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    try {
      await api("/users/me", { method: "PUT", body: { name, phone } });
      await reload();
      setMsg("Your details are saved.");
    } catch (x) {
      setErr(x.message);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg("");
    setPwErr("");
    try {
      const d = await api("/auth/password/change", {
        method: "POST",
        body: { current_password: cur, new_password: next },
      });
      setPwMsg(d.message);
      setCur("");
      setNext("");
    } catch (x) {
      setPwErr(x.message);
    }
  }

  return (
    <div>
      <h1 className="font-display text-4xl mb-6">My account</h1>
      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <AccountMenu />
        <div className="space-y-6">
          <form onSubmit={saveProfile} className="card p-6">
            <h2 className="font-display text-2xl mb-4">Personal details</h2>
            <NoticeBox>{msg}</NoticeBox>
            <ErrorBox>{err}</ErrorBox>
            <div className="grid gap-x-6 md:grid-cols-2">
              <Field label="Full name">
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Phone number">
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="numeric"
                />
              </Field>
            </div>
            <Field label="Email" hint="Your email cannot be changed here.">
              <input className="input bg-cream" value={user.email} readOnly />
            </Field>
            <button className="btn-gold">Save changes</button>
          </form>
          <form onSubmit={changePassword} className="card p-6">
            <h2 className="font-display text-2xl mb-4">Change password</h2>
            <NoticeBox>{pwMsg}</NoticeBox>
            <ErrorBox>{pwErr}</ErrorBox>
            <div className="grid gap-x-6 md:grid-cols-2">
              <Field label="Current password">
                <PasswordInput
                  value={cur}
                  onChange={(e) => setCur(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </Field>
              <Field label="New password">
                <PasswordInput
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </Field>
            </div>
            <button className="btn-outline">Update password</button>
          </form>
        </div>
      </div>
    </div>
  );
}
