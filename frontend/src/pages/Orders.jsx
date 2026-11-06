import { useEffect, useState } from "react";
import { api } from "../api";

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;
const label = (value) => String(value || "").replaceAll("_", " ");

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      setOrders(await api("/orders"));
    } catch (err) {
      setError(err.message || "Could not load your orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function cancelOrder(order) {
    const reason = window.prompt("Please enter a reason for cancellation:");
    if (!reason || reason.trim().length < 3) return;
    setBusy(`cancel-${order.id}`);
    setNotice("");
    try {
      await api(`/orders/${order.id}/cancel`, {
        method: "POST",
        body: { reason: reason.trim() },
      });
      setNotice(`Order ${order.order_number} was cancelled.`);
      await loadOrders();
    } catch (err) {
      setError(err.message || "Cancellation failed.");
    } finally {
      setBusy("");
    }
  }

  async function returnItem(order, item) {
    const reason = window.prompt(`Why are you returning ${item.name}?`);
    if (!reason || reason.trim().length < 3) return;
    const comment = window.prompt("Additional details (optional):") || "";
    setBusy(`return-${item.id}`);
    setNotice("");
    try {
      await api(`/orders/${order.id}/returns`, {
        method: "POST",
        body: {
          order_item_id: item.id,
          reason: reason.trim(),
          comment: comment.trim(),
        },
      });
      setNotice(`Return request submitted for ${item.name}.`);
      await loadOrders();
    } catch (err) {
      setError(err.message || "Return request failed.");
    } finally {
      setBusy("");
    }
  }

  if (loading)
    return <p className="py-10 text-center text-body">Loading your orders…</p>;
  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">My orders</h1>
        <p className="mt-1 text-sm text-muted">
          View order history, track progress, request cancellations and returns.
        </p>
      </div>
      {notice && (
        <div
          role="status"
          className="rounded-lg bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {!orders.length && !error && (
        <div className="rounded-xl border border-line bg-card p-8 text-center text-muted">
          You haven't placed any orders yet.
        </div>
      )}

      {orders.map((order) => (
        <article
          key={order.id}
          className="rounded-xl border border-line bg-card p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="text-xs text-muted">Order number</p>
              <h2 className="font-semibold text-ink">{order.order_number}</h2>
              <p className="mt-1 text-sm text-muted">
                Seller: {order.seller_name || "—"}
              </p>
            </div>
            <div className="text-right">
              <span className="rounded-full bg-sand px-3 py-1 text-sm font-semibold capitalize text-ink">
                {label(order.status)}
              </span>
              <p className="mt-2 font-semibold text-ink">
                {money(order.total)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Items</h3>
              {order.items.map((item) => {
                const existingReturn = order.returns.find(
                  (r) => r.order_item_id === item.id,
                );
                return (
                  <div
                    key={item.id}
                    className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-body">
                      {item.name} × {item.quantity}{" "}
                      <span className="text-muted">({money(item.price)})</span>
                    </span>
                    {order.status === "delivered" && !existingReturn && (
                      <button
                        disabled={busy === `return-${item.id}`}
                        onClick={() => returnItem(order, item)}
                        className="text-sm font-semibold text-ink underline disabled:opacity-50"
                      >
                        {busy === `return-${item.id}`
                          ? "Submitting…"
                          : "Request return"}
                      </button>
                    )}
                    {existingReturn && (
                      <span className="text-xs capitalize text-muted">
                        Return: {label(existingReturn.status)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">
                Order tracking
              </h3>
              {order.tracking.length ? (
                <ol className="space-y-2">
                  {order.tracking.map((entry, index) => (
                    <li
                      key={`${entry.status}-${index}`}
                      className="flex gap-2 text-sm"
                    >
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" />
                      <span className="capitalize text-body">
                        {label(entry.status)}{" "}
                        <span className="block text-xs text-muted">
                          {entry.changed_at
                            ? new Date(entry.changed_at).toLocaleString()
                            : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">No tracking updates yet.</p>
              )}
              <p className="mt-3 text-sm text-muted">
                Payment:{" "}
                <span className="capitalize">
                  {label(order.payment_method)} · {label(order.payment_status)}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted">
                Refund:{" "}
                <span className="capitalize">{label(order.refund_status)}</span>
              </p>
            </div>
          </div>

          {order.status === "placed" || order.status === "confirmed" ? (
            <div className="border-t border-line pt-3">
              <button
                disabled={busy === `cancel-${order.id}`}
                onClick={() => cancelOrder(order)}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
              >
                {busy === `cancel-${order.id}` ? "Cancelling…" : "Cancel order"}
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
