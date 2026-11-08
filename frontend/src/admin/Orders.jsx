import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Empty, Pager, Pill, SearchBox, Tabs, Td, Th, fmtDate, inr, useFetch } from "./adminUi";

export default function Orders() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useFetch(`/admin/orders?status=${status}&q=${encodeURIComponent(q)}&page=${page}`);
  const tabs = ["all", "placed", "confirmed", "shipped", "delivered", "cancelled"].map((k) => [k, k[0].toUpperCase() + k.slice(1)]);

  return (
    <div>
      <h1 className="font-display text-4xl mb-6">Orders</h1>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={tabs} active={status} onChange={(k) => { setStatus(k); setPage(1); }} />
        <SearchBox placeholder="Search order number or customer" onSearch={(v) => { setQ(v); setPage(1); }} />
      </div>
      <Card title="All orders">
        {error && <p className="text-red-800">{error}</p>}
        {!data ? <p className="text-muted">Loading...</p> : data.items.length === 0 ? <Empty>No orders found.</Empty> : (
          <table className="w-full"><thead><tr><Th>Order</Th><Th>Customer</Th><Th>Seller</Th><Th>Items</Th><Th>Total</Th><Th>Payment</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{data.items.map((o) => (
              <tr key={o.id}><Td>{o.order_number}<br /><span className="text-xs text-muted">{fmtDate(o.placed_at)}</span></Td><Td>{o.customer}</Td><Td>{o.seller}</Td><Td>{o.items}</Td><Td>{inr(o.total)}</Td>
                <Td>{o.payment_method === "cod" ? "Cash on delivery" : "Online (test)"}</Td><Td><Pill s={o.status} /></Td>
                <Td><Link className="link" to={`/admin/orders/${o.id}`}>View</Link></Td></tr>
            ))}</tbody></table>
        )}
      </Card>
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
    </div>
  );
}
