import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Empty, Pager, Pill, SearchBox, Tabs, Td, Th, fmtDate, useFetch } from "./adminUi";

export default function Sellers() {
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useFetch(`/admin/sellers?status=${status}&q=${encodeURIComponent(q)}&page=${page}`);
  const c = data?.counts || {};
  const tabs = [["pending", `Pending (${c.pending ?? 0})`], ["approved", `Approved (${c.approved ?? 0})`], ["blocked", `Blocked (${c.blocked ?? 0})`], ["rejected", `Rejected (${c.rejected ?? 0})`]];

  return (
    <div>
      <h1 className="font-display text-4xl mb-6">Sellers</h1>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={tabs} active={status} onChange={(k) => { setStatus(k); setPage(1); }} />
        <SearchBox placeholder="Search sellers" onSearch={(v) => { setQ(v); setPage(1); }} />
      </div>
      <Card title="Seller applications and accounts">
        {error && <p className="text-red-800">{error}</p>}
        {!data ? <p className="text-muted">Loading...</p> : data.items.length === 0 ? <Empty>No sellers in this list.</Empty> : (
          <table className="w-full"><thead><tr><Th>Seller</Th><Th>Shop</Th><Th>Applied</Th><Th>Products</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{data.items.map((s) => (
              <tr key={s.id}><Td>{s.owner}</Td><Td>{s.shop_name}</Td><Td>{fmtDate(s.applied_at)}</Td><Td>{s.products}</Td><Td><Pill s={s.status} /></Td>
                <Td><Link className="link" to={`/admin/sellers/${s.id}`}>Review</Link></Td></tr>
            ))}</tbody></table>
        )}
      </Card>
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
    </div>
  );
}
