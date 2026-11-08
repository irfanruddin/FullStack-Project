import { useState } from "react";
import { BarChart, Card, Empty, Kpi, Tabs, Td, Th, inr, useFetch } from "./adminUi";

export default function Reports() {
  const [period, setPeriod] = useState("7d");
  const { data, error } = useFetch(`/admin/reports?period=${period}`);
  const maxCat = Math.max(1, ...(data?.top_categories || []).map((c) => c.sales));

  return (
    <div>
      <h1 className="font-display text-4xl mb-6">Reports</h1>
      <div className="mb-5"><Tabs items={[["7d", "Last 7 days"], ["30d", "Last 30 days"], ["year", "This year"]]} active={period} onChange={setPeriod} /></div>
      {error && <p className="text-red-800">{error}</p>}
      {!data ? <p className="text-muted">Loading...</p> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi title="Sales" value={inr(data.kpis.sales)} /><Kpi title="Orders" value={data.kpis.orders} />
            <Kpi title="New users" value={data.kpis.new_users} /><Kpi title="Cancelled orders" value={data.kpis.cancelled} />
          </div>
          <Card title={period === "year" ? "Sales by month" : "Sales by day"} right={<span className="text-sm text-muted">{period === "year" ? "This year" : period === "7d" ? "Last 7 days" : "Last 30 days"}</span>} className="mt-6">
            <BarChart series={data.series} height={220} />
          </Card>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card title="Top sellers">
              {data.top_sellers.length === 0 ? <Empty>No sales in this period.</Empty> : (
                <table className="w-full"><thead><tr><Th>Seller</Th><Th>Orders</Th><Th>Sales</Th></tr></thead>
                  <tbody>{data.top_sellers.map((s) => <tr key={s.shop_name}><Td>{s.shop_name}</Td><Td>{s.orders}</Td><Td>{inr(s.sales)}</Td></tr>)}</tbody></table>
              )}
            </Card>
            <Card title="Top categories">
              {data.top_categories.length === 0 ? <Empty>No sales in this period.</Empty> : data.top_categories.map((c, i) => (
                <div key={c.name} className="mb-3 flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0">{c.name}</span>
                  <div className="h-5 flex-1"><div className={`h-5 rounded ${i === 0 ? "bg-gold" : "bg-ink"}`} style={{ width: `${(c.sales / maxCat) * 100}%` }} /></div>
                  <span className="w-24 text-right text-muted">{inr(c.sales)}</span>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
