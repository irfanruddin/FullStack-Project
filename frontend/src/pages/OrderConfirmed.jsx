import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { downloadFile } from "../api";
import { cartChanged } from "../cart";
import Steps from "../components/Steps";

const inr = (n) => `₹ ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function OrderConfirmed() {
  const [error, setError] = useState("");
  let order = null;
  try { order = JSON.parse(sessionStorage.getItem("uc_last_order")); } catch { /* none */ }
  useEffect(() => { cartChanged(); }, []);
  if (!order || order.next === "pay" || !order.orders?.length) return <Navigate to="/" replace />;

  const cod = order.payment_method === "cod";
  const invoice = async (o) => { try { await downloadFile(`/orders/${o.id}/invoice`, `invoice-${o.order_number}.html`); } catch (e) { setError(e.message); } };

  return (
    <div className="mx-auto max-w-[640px] text-center">
      <Steps current={4} />
      <div className="mx-auto mb-6 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-gold text-4xl font-bold">✓</div>
      <h1 className="font-display text-5xl">Order placed</h1>
      <p className="mt-3 text-lg text-muted">Thank you. {order.orders.length > 1 ? `Your items are from ${order.orders.length} sellers, so you have ${order.orders.length} orders.` : "Your order is confirmed."}</p>
      <p className="text-sm text-muted">A confirmation and invoice have been sent to your email.</p>

      <div className="card mt-8 divide-y divide-line text-left">
        {order.orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div><p className="font-bold">Order {o.order_number}</p><p className="text-sm text-muted">Sold by {o.seller_name}</p></div>
            <div className="text-right"><p className="text-lg font-bold">{inr(o.total)}</p><button className="link text-sm" onClick={() => invoice(o)}>Download invoice</button></div>
          </div>
        ))}
        <div className="flex justify-between p-5 text-sm"><span className="text-muted">Payment</span><span className="font-bold">{cod ? `Cash on delivery, pay ${inr(order.total)} when it arrives` : "Paid online (test mode)"}</span></div>
      </div>
      {error && <p className="mt-3 text-sm font-bold text-red-700">{error}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link to="/orders" className="btn-gold px-10 min-h-[52px]">Track order</Link>
        <Link to="/products" className="btn-outline px-10 min-h-[52px]">Continue shopping</Link>
      </div>
    </div>
  );
}
