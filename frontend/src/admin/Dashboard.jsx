import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { BarChart, Card, Empty, Kpi, Pill, Td, Th, fmtDate, inr, useFetch } from "./adminUi";

export default function Dashboard() {
  const { data, error, reload } = useFetch("/admin/dashboard");
  const navigate = useNavigate();
  if (error) return <p className="text-red-800">{error}</p>;
  if (!data) return <p className="text-muted">Loading...</p>;
  const t = data.totals;
  const approve = async (id) => { await api(`/admin/sellers/${id}/approve`, { method: "PATCH" }); reload(); };

  return (
    <div>
      <h1 className="font-display text-4xl mb-6">Admin dashboard</h1>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Users" value={t.users.toLocaleString("en-IN")} /><Kpi title="Sellers" value={t.sellers.toLocaleString("en-IN")} />
        <Kpi title="Orders" value={t.orders.toLocaleString("en-IN")} /><Kpi title="Sales" value={inr(t.sales)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card title={`Seller approvals${data.pending_count ? ` (${data.pending_count})` : ""}`} right={<Link to="/admin/sellers" className="link text-sm">View all sellers</Link>}>
          {data.pending_sellers.length === 0 && <Empty>No applications are waiting.</Empty>}
          {data.pending_sellers.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 border-t border-line py-4">
              <div><p className="font-bold">{s.owner}</p><p className="text-sm text-muted">{s.shop_name}, applied {fmtDate(s.applied_at)}</p></div>
              <div className="flex gap-2">
                <button className="btn-dark !min-h-[38px] !px-4" onClick={() => approve(s.id)}>Approve</button>
                <button className="btn-outline !min-h-[38px] !px-4" onClick={() => navigate(`/admin/sellers/${s.id}`)}>Reject</button>
              </div>
            </div>
          ))}
        </Card>
        <Card title="Sales by day" right={<span className="text-sm text-muted">Last 7 days</span>}><BarChart series={data.sales_by_day} /></Card>
      </div>
      <Card title="Latest orders" className="mt-6" right={<Link to="/admin/orders" className="link text-sm">All orders</Link>}>
        {data.latest_orders.length === 0 ? <Empty>No orders yet.</Empty> : (
          <table className="w-full"><thead><tr><Th>Order</Th><Th>Customer</Th><Th>Seller</Th><Th>Total</Th><Th>Status</Th></tr></thead>
            <tbody>{data.latest_orders.map((o) => (
              <tr key={o.id}><Td><Link className="link" to={`/admin/orders/${o.id}`}>{o.order_number}</Link></Td><Td>{o.customer}</Td><Td>{o.seller}</Td><Td>{inr(o.total)}</Td><Td><Pill s={o.status} /></Td></tr>
            ))}</tbody></table>
        )}
      </Card>
    </div>
  );
}
