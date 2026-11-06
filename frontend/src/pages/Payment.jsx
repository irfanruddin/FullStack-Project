import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { cartChanged } from "../cart";
import Steps from "../components/Steps";
import { Field, ErrorBox } from "../components/ui";

const inr = (n) => `₹ ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const saved = () => { try { return JSON.parse(sessionStorage.getItem("uc_last_order")); } catch { return null; } };

export default function Payment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ref = params.get("ref");
  const order = saved();
  const [tab, setTab] = useState("card");
  const [f, setF] = useState({ card_number: "", name: "", expiry: "", cvv: "", upi_id: "" });
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!ref || !order || order.ref !== ref) return <Navigate to="/checkout" replace />;

  const done = (data) => { sessionStorage.setItem("uc_last_order", JSON.stringify({ ...order, ...data, payment_method: data.payment_method || order.payment_method })); cartChanged(); navigate("/order-confirmed"); };

  async function pay(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = tab === "card" ? { ref, method: "card", card_number: f.card_number, name: f.name, expiry: f.expiry, cvv: f.cvv } : { ref, method: "upi", upi_id: f.upi_id };
      const d = await api("/payments/test-pay", { method: "POST", body });
      if (d.status === "success") done({ orders: d.orders, total: d.total, payment_method: "online", next: "done" });
      else setFailed(true);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function payCod() {
    setBusy(true); setError("");
    try {
      const d = await api("/orders", { method: "POST", body: { address_id: order.address_id, payment_method: "cod" } });
      sessionStorage.setItem("uc_last_order", JSON.stringify(d)); cartChanged(); navigate("/order-confirmed");
    } catch (err) { setError(err.message); setFailed(false); } finally { setBusy(false); }
  }

  if (failed) {
    return (
      <div className="mx-auto max-w-[620px] text-center">
        <Steps current={2} />
        <div className="mx-auto mb-6 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-red-700 text-4xl font-bold text-white">×</div>
        <h1 className="font-display text-5xl">Payment failed</h1>
        <p className="mt-3 text-lg text-muted">No money was charged, and your order is not placed yet.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button className="btn-gold px-10 min-h-[52px]" onClick={() => setFailed(false)}>Try again</button>
          <button className="btn-outline px-10 min-h-[52px]" onClick={payCod} disabled={busy}>Pay with Cash on Delivery</button>
        </div>
        <p className="mt-6"><Link to="/checkout" className="link">Back to checkout</Link></p>
      </div>
    );
  }

  return (
    <div>
      <Steps current={2} />
      <h1 className="font-display text-4xl mb-4">Online payment</h1>
      <div className="mb-6 rounded-lg border border-gold bg-[#F3E2A5] px-5 py-3 text-sm font-bold">Test mode: no real money is charged. Enter any test details.</div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <form onSubmit={pay} className="card p-6" noValidate>
          <h2 className="font-display text-2xl mb-4">Pay with</h2>
          <div className="mb-6 flex gap-3">
            {["card", "upi"].map((t) => <button type="button" key={t} onClick={() => setTab(t)} className={`rounded-full px-6 py-2 text-sm uppercase ${tab === t ? "bg-gold font-bold" : "border border-line bg-cream"}`}>{t}</button>)}
          </div>
          <ErrorBox>{error}</ErrorBox>
          {tab === "card" ? (
            <>
              <Field label="Card number"><input className="input" value={f.card_number} onChange={set("card_number")} placeholder="0000 0000 0000 0000" inputMode="numeric" /></Field>
              <Field label="Name on card"><input className="input" value={f.name} onChange={set("name")} /></Field>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <Field label="Expiry"><input className="input" value={f.expiry} onChange={set("expiry")} placeholder="MM/YY" /></Field>
                <Field label="CVV"><input className="input" value={f.cvv} onChange={set("cvv")} placeholder="000" inputMode="numeric" /></Field>
              </div>
            </>
          ) : (
            <Field label="UPI id"><input className="input" value={f.upi_id} onChange={set("upi_id")} placeholder="name@bank" /></Field>
          )}
          <button className="btn-gold mt-2 w-full min-h-[52px]" disabled={busy}>{busy ? "Processing..." : `Pay ${inr(order.total)}`}</button>
          <p className="mt-4 text-xs text-muted">To see a failed payment, use a card number ending in 0000, or a UPI id containing "fail". Anything else succeeds.</p>
        </form>
        <aside className="card h-fit p-6">
          <h2 className="font-display text-2xl mb-4">Order summary</h2>
          {order.orders.map((o) => <div key={o.id} className="flex justify-between py-1 text-sm"><span className="text-muted">{o.order_number} ({o.seller_name})</span><span>{inr(o.total)}</span></div>)}
          <div className="my-4 border-t border-line" />
          <div className="flex justify-between text-xl font-bold"><span>Total</span><span>{inr(order.total)}</span></div>
          <Link to="/checkout" className="link mt-4 block text-sm">Back to checkout</Link>
        </aside>
      </div>
    </div>
  );
}
