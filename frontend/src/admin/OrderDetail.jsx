import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Card, Pill, fmtDate, inr, label, useFetch } from "./adminUi";
import { ErrorBox, NoticeBox } from "../components/ui";

const FLOW = ["placed", "confirmed", "shipped", "delivered"];

export default function OrderDetail() {
  const { id } = useParams();
  const { data: o, error, reload } = useFetch(`/admin/orders/${id}`);
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (error) return <p className="text-red-800">{error}</p>;
  if (!o) return <p className="text-muted">Loading...</p>;

  const cancelled = o.status === "cancelled";
  const step = FLOW.indexOf(o.status);
  async function run(promise, ok) {
    setMsg(""); setErr("");
    try { await promise; setMsg(ok); reload(); } catch (e) { setErr(e.message); }
  }
  const updateStatus = () => next && run(api(`/admin/orders/${id}/status`, { method: "PATCH", body: { status: next } }), `Status changed to ${next}. The customer was emailed.`);
  const cancel = () => {
    const reason = window.prompt("Reason for cancelling this order (the customer and the seller are emailed):");
    if (reason !== null) run(api(`/admin/orders/${id}/cancel`, { method: "POST", body: { reason } }), "Order cancelled and the stock was put back.");
  };

  return (
    <div>
      <p className="text-xs text-muted"><Link to="/admin/orders">Orders</Link> / {o.order_number}</p>
      <h1 className="font-display text-4xl">Order {o.order_number}</h1>
      <div className="mb-5 mt-2"><Pill s={o.status} /></div>

      <Card className="mb-6">
        {cancelled ? <p className="font-bold text-red-800">Cancelled{o.cancel_reason ? `: ${o.cancel_reason}` : ""}</p> : (
          <ol className="flex items-start justify-between">
            {FLOW.map((s, i) => (
              <li key={s} className="flex flex-1 flex-col items-center gap-2 text-sm">
                <span className={`h-5 w-5 rounded-full border-2 ${i < step ? "border-gold bg-gold" : i === step ? "border-ink bg-ink" : "border-line bg-card"}`} />
                <span className={i === step ? "font-bold" : ""}>{label(s)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Card title="Items">
            {o.items.map((i, n) => (
              <div key={n} className="flex items-center justify-between border-b border-line py-3">
                <div><p className="font-bold">{i.name}</p><p className="text-sm text-muted">Quantity {i.quantity}, {inr(i.price)} each</p></div><p className="font-bold">{inr(i.line_total)}</p>
              </div>
            ))}
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Items subtotal</dt><dd>{inr(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd>{inr(o.tax)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{inr(o.delivery_charge)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><dt>Total</dt><dd>{inr(o.total)}</dd></div>
            </dl>
          </Card>
          <Card title="Status history">
            {o.history.map((h, n) => <p key={n} className="text-sm"><Pill s={h.status} /> <span className="ml-2 text-muted">{fmtDate(h.at)}</span></p>)}
          </Card>
          {o.returns.length > 0 && (
            <Card title="Returns" right={<Link to="/admin/returns" className="link text-sm">All returns</Link>}>
              {o.returns.map((r) => <p key={r.id} className="text-sm"><span className="font-bold">{r.item}</span> (x{r.quantity}) <Pill s={r.status} /> <span className="text-muted">{r.reason}</span></p>)}
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Customer"><p className="font-bold">{o.customer_detail.name}</p><p className="text-sm text-muted">{o.customer_detail.phone}</p><p className="text-sm text-muted">{o.customer_detail.address}</p></Card>
          <Card title="Seller"><p className="font-bold">{o.seller_detail.shop_name}</p><p className="text-sm text-muted">{o.seller_detail.owner}</p></Card>
          <Card title="Payment"><p className="text-sm">{o.payment_method === "cod" ? "Cash on delivery" : "Online payment (test mode)"}, {inr(o.total)}</p><p className="text-sm text-muted">Payment status: {label(o.payment_status)}</p></Card>
          <Card title="Admin actions">
            <NoticeBox>{msg}</NoticeBox><ErrorBox>{err}</ErrorBox>
            <label className="label">Change status</label>
            <select className="input" value={next} onChange={(e) => setNext(e.target.value)} disabled={cancelled}>
              <option value="">Choose a status</option>{FLOW.filter((s) => s !== o.status).map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
            <button className="btn-gold mt-4 w-full" onClick={updateStatus} disabled={!next || cancelled}>Update status</button>
            <button className="btn-outline mt-3 w-full" onClick={cancel} disabled={cancelled || o.status === "delivered"}>Cancel order</button>
            <p className="mt-3 text-xs text-muted">Use only for stuck or disputed orders. A delivered order uses the return flow.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
