import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, imageUrl } from "../../api";
import { useAuth } from "../../auth";
import { ErrorBox, NoticeBox } from "../../components/ui";

const routeTabs = { "/seller/dashboard": "Overview", "/seller/products": "Products", "/seller/orders": "Orders", "/seller/sales": "Sales", "/seller/profile": "Shop profile" };
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const blankProduct = { category_id: "", name: "", description: "", price: "", stock: 0, status: "active" };

function Panel({ title, children, action }) {
  return <section className="card p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{title}</h2>{action}</div>{children}</section>;
}
function Stat({ label, value }) { return <div className="card p-5"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>; }

export default function SellerDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = routeTabs[location.pathname] || "Overview";
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [profile, setProfile] = useState({ shop_name: "", description: "", category: "", pickup_address: "", city: "", pincode: "" });
  const [report, setReport] = useState(null);
  const [days, setDays] = useState(30);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankProduct);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async (section = tab) => {
    setError("");
    try {
      if (section === "Overview") setDashboard(await api("/seller/dashboard"));
      if (section === "Products") { const [p, c] = await Promise.all([api("/seller/products"), api("/seller/categories")]); setProducts(p); setCategories(c); }
      if (section === "Orders") { const [o, r] = await Promise.all([api("/seller/orders"), api("/seller/returns")]); setOrders(o); setReturns(r); }
      if (section === "Returns") setReturns(await api("/seller/returns"));
      if (section === "Shop profile") setProfile(await api("/seller/profile"));
      if (section === "Sales") setReport(await api(`/seller/reports/sales?days=${days}`));
    } catch (e) { setError(e.message || "Could not load seller data."); }
  };
  useEffect(() => { load("Overview"); }, []);
  useEffect(() => { if (tab !== "Overview") load(tab); }, [tab, days]);

  const saveProduct = async (e) => {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const body = { ...form, category_id: Number(form.category_id), price: Number(form.price), stock: Number(form.stock) };
      const saved = editing ? await api(`/seller/products/${editing}`, { method: "PUT", body }) : await api("/seller/products", { method: "POST", body });
      const files = Array.from(e.target.images?.files || []);
      for (const file of files) { const data = new FormData(); data.append("file", file); await api(`/seller/products/${saved.id}/images`, { method: "POST", body: data, form: true }); }
      setEditing(null); setForm(blankProduct); setNotice("Product saved successfully."); await load("Products");
    } catch (e2) { setError(e2.message || "Could not save product."); }
    finally { setBusy(false); }
  };
  const editProduct = (p) => { setEditing(p.id); setForm({ category_id: String(p.category_id), name: p.name, description: p.description || "", price: p.price, stock: p.stock, status: p.status }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const removeProduct = async (p) => { if (!confirm(`Delete or hide “${p.name}”?`)) return; try { const r = await api(`/seller/products/${p.id}`, { method: "DELETE" }); setNotice(r.message); await load("Products"); } catch (e) { setError(e.message); } };
  const changeOrder = async (o) => { const next = ({ placed: "confirmed", confirmed: "shipped", shipped: "delivered" })[o.status]; if (!next || !confirm(`Mark ${o.order_number} as ${next}?`)) return; try { await api(`/seller/orders/${o.id}/status`, { method: "PATCH", body: { status: next } }); setNotice(`Order updated to ${next}.`); await load("Orders"); } catch (e) { setError(e.message); } };
  const decideReturn = async (r, status) => { const reject_reason = status === "rejected" ? prompt("Enter reason for rejecting this return:") : null; if (status === "rejected" && !reject_reason?.trim()) return; try { await api(`/seller/returns/${r.id}`, { method: "PATCH", body: { status, reject_reason } }); setNotice(`Return ${status}.`); await load("Returns"); } catch (e) { setError(e.message); } };
  const saveProfile = async (e) => { e.preventDefault(); try { await api("/seller/profile", { method: "PUT", body: profile }); setNotice("Shop profile updated."); } catch (e2) { setError(e2.message); } };

  if (user?.seller_status !== "approved") return <main className="mx-auto max-w-4xl px-6 py-16"><NoticeBox>Your seller account status is <b>{user?.seller_status || "pending"}</b>. Seller tools become available after admin approval.</NoticeBox><p className="text-sm text-muted">Please check again after your application has been reviewed.</p></main>;

  return <main className="mx-auto max-w-[1200px] px-6 py-8">
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-muted">Seller workspace</p><h1 className="font-display text-3xl font-bold">{tab === "Overview" ? (dashboard?.shop_name || "Seller dashboard") : ({Products:"Products", Orders:"Orders", Sales:"Sales report", "Shop profile":"Shop profile"}[tab])}</h1><p className="mt-1 text-muted">Manage your shop, products, orders and sales.</p></div>{(tab === "Overview" || tab === "Products") && <button className="btn-gold" onClick={() => { navigate("/seller/products"); setEditing(null); setForm(blankProduct); }}>Add product</button>}</div>
    <ErrorBox>{error}</ErrorBox><NoticeBox>{notice}</NoticeBox>
    {tab === "Overview" && <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["Products", dashboard?.stats.products], ["Active products", dashboard?.stats.active_products], ["Low stock", dashboard?.stats.low_stock], ["Out of stock", dashboard?.stats.out_of_stock], ["Orders", dashboard?.stats.orders], ["Sales", money(dashboard?.stats.sales)]].map(([l,v]) => <Stat key={l} label={l} value={v ?? "—"} />)}</div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2"><Panel title="Low-stock alerts">{dashboard?.low_stock_products?.length ? dashboard.low_stock_products.map(p => <p key={p.id} className="border-b border-line py-2">{p.name} <b className="float-right">{p.stock} left</b></p>) : <p className="text-muted">No low-stock products.</p>}</Panel><Panel title="Recent orders">{dashboard?.recent_orders?.length ? dashboard.recent_orders.map(o => <p key={o.id} className="border-b border-line py-2">{o.order_number} · {o.status}<b className="float-right">{money(o.total)}</b></p>) : <p className="text-muted">No orders yet.</p>}</Panel></div>
    </>}
    {tab === "Products" && <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Panel title={editing ? "Edit product" : "Add product"}><form onSubmit={saveProduct}>
        <label className="label">Product name</label><input className="input mb-3" required minLength="2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
        <label className="label">Category</label><select className="input mb-3" required value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <label className="label">Description</label><textarea className="input mb-3" rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
        <div className="grid grid-cols-2 gap-3"><div><label className="label">Price (₹)</label><input className="input mb-3" type="number" min="0.01" step="0.01" required value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></div><div><label className="label">Stock</label><input className="input mb-3" type="number" min="0" required value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/></div></div>
        <label className="label">Visibility</label><select className="input mb-3" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Active</option><option value="hidden">Hidden</option></select>
        <label className="label">Product images (JPG, PNG, WEBP; max 5 MB each)</label><input className="mb-4 block w-full text-sm" name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple/>
        <button className="btn-gold w-full" disabled={busy}>{busy ? "Saving…" : editing ? "Update product" : "Add product"}</button>{editing && <button type="button" className="btn-outline mt-2 w-full" onClick={()=>{setEditing(null);setForm(blankProduct)}}>Cancel edit</button>}
      </form></Panel>
      <Panel title={`Your products (${products.length})`}>{products.length ? <div className="space-y-3">{products.map(p=><div key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">{p.images?.[0] && <img src={imageUrl(p.images[0].file_path)} className="h-16 w-16 rounded object-cover"/>}<div className="min-w-0 flex-1"><b>{p.name}</b><p className="text-sm text-muted">{p.category_name} · {money(p.price)} · Stock: {p.stock} · {p.status}</p></div><button className="link" onClick={()=>editProduct(p)}>Edit</button><button className="text-sm font-bold text-red-700" onClick={()=>removeProduct(p)}>Delete / hide</button></div>)}</div> : <p className="text-muted">No products added yet.</p>}</Panel>
    </div>}
    {tab === "Orders" && <div className="space-y-6"><Panel title="Customer orders">{orders.length ? <div className="space-y-4">{orders.map(o=><article key={o.id} className="rounded-lg border border-line p-4"><div className="flex flex-wrap justify-between gap-2"><b>{o.order_number}</b><b>{money(o.total)}</b></div><p className="mt-1 text-sm text-muted">{o.customer_name} · {o.customer_phone} · {o.status} · {o.payment_method.toUpperCase()}</p><p className="text-sm">{o.shipping_address}</p><ul className="my-2 list-inside list-disc text-sm">{o.items.map(i=><li key={i.id}>{i.name} × {i.quantity}</li>)}</ul>{({placed:"Confirm order",confirmed:"Mark as shipped",shipped:"Mark as delivered"})[o.status] && <button className="btn-gold mt-2" onClick={()=>changeOrder(o)}>{({placed:"Confirm order",confirmed:"Mark as shipped",shipped:"Mark as delivered"})[o.status]}</button>}</article>)}</div> : <p className="text-muted">No orders yet.</p>}</Panel><Panel title="Return requests">{returns.length ? <div className="space-y-3">{returns.map(r=><div key={r.id} className="rounded-lg border border-line p-4"><b>Return #{r.id} · Order #{r.order_id}</b><p className="text-sm">Reason: {r.reason} · Quantity: {r.quantity}</p>{r.comment && <p className="text-sm text-muted">{r.comment}</p>}<p className="text-sm">Status: <b>{r.status}</b></p>{r.status === "requested" && <div className="mt-3 flex gap-2"><button className="btn-gold" onClick={()=>decideReturn(r,"approved")}>Approve</button><button className="btn-outline" onClick={()=>decideReturn(r,"rejected")}>Reject</button></div>}</div>)}</div> : <p className="text-muted">No return requests.</p>}</Panel></div>}
    {tab === "Sales" && <Panel title="Sales report" action={<select className="input max-w-40" value={days} onChange={e=>setDays(Number(e.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></select>}><div className="mb-4 grid gap-4 sm:grid-cols-2"><Stat label="Sales total" value={money(report?.sales_total)}/><Stat label="Orders counted" value={report?.order_count ?? "—"}/></div>{report?.orders?.map((o,i)=><p key={i} className="border-b border-line py-2">{o.order_number} · {new Date(o.date).toLocaleDateString()} · {o.status}<b className="float-right">{money(o.total)}</b></p>)}<p className="mt-3 text-xs text-muted">Sales include confirmed, shipped and delivered orders; cancelled and pending-payment orders are excluded. This is an order-value report, not a payment settlement statement.</p></Panel>}
    {tab === "Shop profile" && <Panel title="Shop profile"><form onSubmit={saveProfile} className="max-w-2xl"><label className="label">Shop name</label><input className="input mb-3" required value={profile.shop_name||""} onChange={e=>setProfile({...profile,shop_name:e.target.value})}/><label className="label">Description</label><textarea className="input mb-3" rows="4" value={profile.description||""} onChange={e=>setProfile({...profile,description:e.target.value})}/><label className="label">Business category</label><input className="input mb-3" value={profile.category||""} onChange={e=>setProfile({...profile,category:e.target.value})}/><label className="label">Pickup address</label><input className="input mb-3" value={profile.pickup_address||""} onChange={e=>setProfile({...profile,pickup_address:e.target.value})}/><div className="grid grid-cols-2 gap-3"><div><label className="label">City</label><input className="input mb-3" value={profile.city||""} onChange={e=>setProfile({...profile,city:e.target.value})}/></div><div><label className="label">Pincode</label><input className="input mb-3" value={profile.pincode||""} onChange={e=>setProfile({...profile,pincode:e.target.value})}/></div></div><button className="btn-gold">Save profile</button></form></Panel>}
  </main>;
}
