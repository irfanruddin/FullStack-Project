import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Card, Empty, Pager, Pill, Td, Th, Tabs, fmtDate, inr, label, useFetch } from "./adminUi";

const STATUSES = ["requested", "approved", "shipped_back", "received", "refund_owed", "refunded", "rejected"];

export default function Returns() {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const { data, error: loadError, reload } = useFetch(`/admin/returns?status=${status}&page=${page}`);
  const c = data?.counts || {};
  const tabs = [["all", "All"], ...STATUSES.map((s) => [s, `${label(s)}${c[s] ? ` (${c[s]})` : ""}`])];

  async function paid(r) {
    if (!window.confirm(`Mark the refund of ${inr(r.refund_amount)} for ${r.customer} as paid?`)) return;
    try { await api(`/admin/returns/${r.id}/refund-paid`, { method: "PATCH" }); reload(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <h1 className="font-display text-4xl mb-6">Returns and refunds</h1>
      <div className="mb-5"><Tabs items={tabs} active={status} onChange={(k) => { setStatus(k); setPage(1); }} /></div>
      <Card title="All returns">
        {(error || loadError) && <p className="mb-3 text-sm font-bold text-red-800">{error || loadError}</p>}
        {!data ? <p className="text-muted">Loading...</p> : data.items.length === 0 ? <Empty>No returns in this list.</Empty> : (
          <table className="w-full"><thead><tr><Th>Order</Th><Th>Item</Th><Th>Customer</Th><Th>Seller</Th><Th>Refund</Th><Th>Requested</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{data.items.map((r) => (
              <tr key={r.id}><Td><Link className="link" to={`/admin/orders/${r.order_id}`}>{r.order_number}</Link></Td><Td>{r.item} (x{r.quantity})<br /><span className="text-xs text-muted">{r.reason}</span></Td>
                <Td>{r.customer}</Td><Td>{r.seller}</Td><Td>{r.refund_amount != null ? inr(r.refund_amount) : "–"}<br /><span className="text-xs text-muted">{r.payment_method === "cod" ? "Cash on delivery" : "Online (test)"}</span></Td>
                <Td>{fmtDate(r.requested_at)}</Td><Td><Pill s={r.status} /></Td>
                <Td>{r.status === "refund_owed" && <button className="link" onClick={() => paid(r)}>Mark refund paid</button>}</Td></tr>
            ))}</tbody></table>
        )}
      </Card>
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
    </div>
  );
}
