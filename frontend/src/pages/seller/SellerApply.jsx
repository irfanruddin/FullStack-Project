import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { ErrorBox, Field, NoticeBox, PasswordInput } from "../../components/ui";

const initial = { name:"", email:"", phone:"", password:"", shop_name:"", description:"", category:"", pickup_address:"", city:"", pincode:"" };
export default function SellerApply() {
  const [form,setForm] = useState(initial); const [error,setError] = useState(""); const [notice,setNotice] = useState(""); const [busy,setBusy] = useState(false); const navigate = useNavigate();
  const update = (key,value) => setForm(old => ({...old,[key]:value}));
  async function submit(e) { e.preventDefault(); setError(""); setNotice(""); setBusy(true); try { const result = await api("/seller/apply",{method:"POST",body:form,auth:false}); setNotice(result.message); setTimeout(()=>navigate("/login",{state:{notice:"Seller application submitted. Log in to check its status."}}),900); } catch(err) { setError(err.message || "Could not submit your application."); } finally { setBusy(false); } }
  return <div className="min-h-screen bg-cream px-5 py-10"><div className="mx-auto max-w-3xl rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-9"><Link to="/login" className="link">← Back to login</Link><p className="mt-6 text-sm font-bold uppercase tracking-wider text-gold-dark">Sell on UrbanCart</p><h1 className="mt-2 font-display text-3xl">Seller application</h1><p className="mt-2 mb-6 text-muted">Create your seller account and submit your shop details for administrator approval.</p><ErrorBox>{error}</ErrorBox><NoticeBox>{notice}</NoticeBox><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <Field label="Your full name"><input className="input" required minLength="2" value={form.name} onChange={e=>update("name",e.target.value)}/></Field>
    <Field label="Email address"><input className="input" type="email" required value={form.email} onChange={e=>update("email",e.target.value)}/></Field>
    <Field label="Phone number"><input className="input" required inputMode="numeric" pattern="[0-9]{10}" maxLength="10" value={form.phone} onChange={e=>update("phone",e.target.value)}/></Field>
    <Field label="Password"><PasswordInput value={form.password} onChange={e=>update("password",e.target.value)}/></Field>
    <div className="sm:col-span-2"><hr className="my-2 border-line"/><h2 className="font-display text-xl">Shop information</h2></div>
    <Field label="Shop name"><input className="input" required minLength="2" value={form.shop_name} onChange={e=>update("shop_name",e.target.value)}/></Field>
    <Field label="Business category"><input className="input" value={form.category} onChange={e=>update("category",e.target.value)} placeholder="Clothing, electronics, home…"/></Field>
    <div className="sm:col-span-2"><Field label="Shop description"><textarea className="input" rows="3" value={form.description} onChange={e=>update("description",e.target.value)}/></Field></div>
    <div className="sm:col-span-2"><Field label="Pickup address"><input className="input" required minLength="5" value={form.pickup_address} onChange={e=>update("pickup_address",e.target.value)}/></Field></div>
    <Field label="City"><input className="input" required value={form.city} onChange={e=>update("city",e.target.value)}/></Field>
    <Field label="Pincode"><input className="input" required minLength="6" maxLength="10" value={form.pincode} onChange={e=>update("pincode",e.target.value)}/></Field>
    <div className="sm:col-span-2"><button className="btn-gold w-full" disabled={busy}>{busy ? "Submitting…" : "Submit seller application"}</button><p className="mt-3 text-center text-xs text-muted">Your seller workspace will be enabled after administrator approval.</p></div>
  </form></div></div>;
}
