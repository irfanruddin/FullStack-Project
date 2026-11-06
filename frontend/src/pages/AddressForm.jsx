import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Field, ErrorBox } from "../components/ui";

// Used for "Add a new address" and "Edit address".
// From checkout, open it as /account/addresses/new?return=/checkout so Save goes back there.
const empty = { full_name: "", phone: "", street: "", city: "", state: "", pincode: "", label: "Home", is_default: false };

export default function AddressForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const back = params.get("return") || "/account/addresses";
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!id) return;
    api("/users/me/addresses").then((list) => {
      const a = list.find((x) => String(x.id) === id);
      if (a) setF(a); else setError("Address not found.");
    }).catch((e) => setError(e.message));
  }, [id]);

  function validate() {
    const e = {};
    if (!f.full_name.trim()) e.full_name = "Required.";
    if (!/^[0-9]{10}$/.test(f.phone.trim())) e.phone = "Phone number must be 10 digits.";
    if (!f.street.trim()) e.street = "Required.";
    if (!f.city.trim()) e.city = "Required.";
    if (!f.state.trim()) e.state = "Required.";
    if (!/^[0-9]{6}$/.test(f.pincode.trim())) e.pincode = "Pincode must be 6 digits.";
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
      const { id: _drop, ...body } = f;
      await api(id ? `/users/me/addresses/${id}` : "/users/me/addresses", { method: id ? "PUT" : "POST", body });
      navigate(back);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[780px]">
      <h1 className="font-display text-4xl mb-6">{id ? "Edit address" : "Add a new address"}</h1>
      <form onSubmit={submit} className="card p-6" noValidate>
        <ErrorBox>{error}</ErrorBox>
        <div className="grid gap-x-6 md:grid-cols-2">
          <Field label="Full name" error={errors.full_name}><input className="input" value={f.full_name} onChange={set("full_name")} /></Field>
          <Field label="Phone number" error={errors.phone}><input className="input" value={f.phone} onChange={set("phone")} inputMode="numeric" /></Field>
        </div>
        <div className="grid gap-x-6 md:grid-cols-3">
          <Field label="Pincode" error={errors.pincode}><input className="input" value={f.pincode} onChange={set("pincode")} inputMode="numeric" /></Field>
          <Field label="City" error={errors.city}><input className="input" value={f.city} onChange={set("city")} /></Field>
          <Field label="State" error={errors.state}><input className="input" value={f.state} onChange={set("state")} /></Field>
        </div>
        <Field label="Street address" error={errors.street}><input className="input" value={f.street} onChange={set("street")} placeholder="House number, street, area" /></Field>
        <p className="label">Save address as</p>
        <div className="mb-5 flex gap-3">
          {["Home", "Work"].map((l) => (
            <button type="button" key={l} onClick={() => setF({ ...f, label: l })}
              className={`rounded-full px-6 py-2 text-sm ${f.label === l ? "bg-gold font-bold" : "border border-line bg-cream"}`}>{l}</button>
          ))}
        </div>
        <label className="mb-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.is_default} onChange={(e) => setF({ ...f, is_default: e.target.checked })} /> Use this as my default address</label>
        <div className="flex gap-3">
          <button className="btn-gold" disabled={busy}>{busy ? "Saving..." : id ? "Save changes" : "Save address"}</button>
          <Link to={back} className="btn-outline">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
