import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { cartChanged } from "../cart";
import Steps from "../components/Steps";
import { ErrorBox } from "../components/ui";

const inr = (n) => `₹ ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function Option({ on, onClick, title, sub, right }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left ${on ? "border-gold bg-[#F3E2A5]" : "border-line bg-cream"}`}>
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-card`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}</span>
      <span className="flex-1"><span className="block font-bold">{title}</span><span className="block text-sm text-muted">{sub}</span></span>
      {right}
    </button>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [addressId, setAddressId] = useState(null);
  const [method, setMethod] = useState("cod");
  const [problems, setProblems] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [c, a] = await Promise.all([api("/cart"), api("/users/me/addresses")]);
      setCart(c); setAddresses(a);
      setAddressId((cur) => cur || (a.find((x) => x.is_default) || a[0])?.id || null);
      setProblems(c.items.filter((i) => i.problem).map((i) => ({ item_id: i.id, name: i.name, message: i.problem.message })));
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  if (!cart || !addresses) return <p className="text-muted">{error || "Loading..."}</p>;
  if (cart.items.length === 0) return <Navigate to="/cart" replace />;

  async function removeUnavailable() {
    for (const p of problems) { try { await api(`/cart/items/${p.item_id}`, { method: "DELETE" }); } catch { /* already gone */ } }
    cartChanged();
    await load();
  }

  async function place() {
    setError("");
    if (!addressId) { setError("Choose a delivery address."); return; }
    setBusy(true);
    try {
      const d = await api("/orders", { method: "POST", body: { address_id: addressId, payment_method: method } });
      sessionStorage.setItem("uc_last_order", JSON.stringify(d));
      cartChanged();
      navigate(d.next === "pay" ? `/payment?ref=${d.ref}` : "/order-confirmed");
    } catch (e) {
      if (e.status === 409 && e.data?.problems?.length) {
        setProblems(e.data.problems.map((p) => ({ item_id: p.item_id, name: p.name, message: p.message })));
        await load();
      } else setError(e.message);
    } finally { setBusy(false); }
  }

  const sellers = cart.groups.length;
  const blocked = problems.length > 0;

  return (
    <div>
      <Steps current={2} />
      <h1 className="font-display text-4xl mb-6">Checkout</h1>
      {blocked && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-700 bg-[#F4D3D0] p-5">
          <div>
            <p className="font-bold text-red-900">{problems.length === 1 ? "One item is no longer available" : `${problems.length} items are no longer available`}</p>
            <p className="text-sm text-red-900">{problems.map((p) => `${p.name} (${p.message})`).join(" ")} Remove them to continue, or go back to your cart.</p>
          </div>
          <div className="flex gap-3">
            <button className="btn-dark" onClick={removeUnavailable}>Remove {problems.length === 1 ? "item" : "items"}</button>
            <Link to="/cart" className="btn-outline">Back to cart</Link>
          </div>
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-display text-2xl mb-4">Delivery address</h2>
            <div className="space-y-3">
              {addresses.map((a) => (
                <Option key={a.id} on={addressId === a.id} onClick={() => setAddressId(a.id)}
                  title={`${a.full_name}${a.is_default ? "  (default)" : ""}`} sub={`${a.street}, ${a.city}, ${a.state} ${a.pincode}`}
                  right={<Link to={`/account/addresses/${a.id}/edit?return=/checkout`} className="link text-sm" onClick={(e) => e.stopPropagation()}>Edit</Link>} />
              ))}
              <Link to="/account/addresses/new?return=/checkout" className="flex min-h-[72px] items-center justify-center rounded-lg border-2 border-dashed border-[#C9BC99] bg-cream font-bold text-gold-dark">+ Add a new address</Link>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-display text-2xl mb-4">Payment method</h2>
            <div className="space-y-3">
              <Option on={method === "cod"} onClick={() => setMethod("cod")} title="Cash on delivery" sub="Pay when your order arrives" />
              <Option on={method === "online"} onClick={() => setMethod("online")} title="Online payment" sub="Test mode: no real money is charged" />
            </div>
          </section>

          <section className="card p-6">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-2xl">Review items ({cart.count})</h2><Link to="/cart" className="link text-sm">Edit cart</Link></div>
            <div className="divide-y divide-line">
              {cart.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-4 py-3">
                  <div><p className="font-bold">{i.name}</p><p className="text-sm text-muted">Quantity {i.quantity}, sold by {i.seller_name}</p></div>
                  <p className={`font-bold ${i.problem ? "text-muted line-through" : ""}`}>{inr(i.line_total)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-6">
          <div className="card p-6">
            <h2 className="font-display text-2xl mb-4">Order summary</h2>
            <dl className="space-y-2 text-[15px]">
              <div className="flex justify-between"><dt className="text-muted">Items subtotal</dt><dd>{inr(cart.totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd>{inr(cart.totals.tax)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{cart.totals.delivery ? inr(cart.totals.delivery) : "Free"}</dd></div>
            </dl>
            <div className="my-4 border-t border-line" />
            <div className="flex justify-between text-xl font-bold"><span>Total</span><span>{inr(cart.totals.total)}</span></div>
            {sellers > 1 && <p className="mt-3 text-xs text-muted">{sellers} sellers: this becomes {sellers} separate orders.</p>}
            <p className="mt-3 text-sm text-muted">Paying by {method === "cod" ? "cash on delivery" : "online payment (test)"}</p>
            <button className="btn-gold mt-4 w-full min-h-[52px]" onClick={place} disabled={busy || blocked}>{busy ? "Please wait..." : method === "online" ? "Continue to payment" : "Place order"}</button>
            <p className="mt-3 text-xs text-muted">Stock is checked before your order is confirmed. You will get a confirmation and invoice by email.</p>
          </div>
          <ul className="card space-y-2 p-5 text-sm">
            <li>Cash on delivery available</li><li>Cancel any time before it ships</li><li>Every seller is approved by an admin</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
