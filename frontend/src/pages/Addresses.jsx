import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import AccountMenu from "../components/AccountMenu";
import { ErrorBox } from "../components/ui";
import { useModal } from "../components/ModalContext";

export default function Addresses() {
  const modal = useModal();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");

  const load = () => api("/users/me/addresses").then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function remove(id) {
    const ok = await modal.confirm({
      title: "Remove Address",
      message: "Are you sure you want to remove this address from your account?",
      confirmText: "Remove Address",
      type: "danger",
    });
    if (!ok) return;
    try { await api(`/users/me/addresses/${id}`, { method: "DELETE" }); load(); } catch (e) { setError(e.message); }
  }
  async function makeDefault(id) {
    try { await api(`/users/me/addresses/${id}/default`, { method: "PUT" }); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <h1 className="font-display text-4xl mb-6">My account</h1>
      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <AccountMenu />
        <div>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-3xl">Saved addresses</h2>
            <Link to="/account/addresses/new" className="btn-gold">Add a new address</Link>
          </div>
          <ErrorBox>{error}</ErrorBox>
          {list === null ? <p className="text-muted">Loading...</p> : (
            <div className="grid gap-5 lg:grid-cols-2">
              {list.map((a) => (
                <div key={a.id} className="card p-6">
                  <div className="mb-3 flex gap-2 text-xs font-bold">
                    <span className="rounded-full bg-line px-3 py-1">{a.label}</span>
                    {a.is_default && <span className="rounded-full bg-[#DCEFD9] px-3 py-1 text-green-800">Default</span>}
                  </div>
                  <p className="font-bold">{a.full_name}</p>
                  <p className="text-sm text-muted">{a.street}</p>
                  <p className="text-sm text-muted">{a.city}, {a.state} {a.pincode}</p>
                  <p className="text-sm text-muted">{a.phone}</p>
                  <div className="mt-4 flex justify-between text-sm">
                    <span className="flex gap-4">
                      <Link className="link" to={`/account/addresses/${a.id}/edit`}>Edit</Link>
                      <button className="link" onClick={() => remove(a.id)}>Remove</button>
                    </span>
                    {!a.is_default && <button className="link" onClick={() => makeDefault(a.id)}>Make default</button>}
                  </div>
                </div>
              ))}
              <Link to="/account/addresses/new" className="flex min-h-[170px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#C9BC99] bg-card">
                <span className="font-bold">Add a new address</span>
                <span className="text-sm text-muted">Street, city and pincode</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
