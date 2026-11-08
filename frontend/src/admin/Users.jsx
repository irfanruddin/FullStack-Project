import { useState } from "react";
import { api } from "../api";
import { Card, Empty, Pager, Pill, SearchBox, Tabs, Td, Th, fmtDate, useFetch } from "./adminUi";
import { useModal } from "../components/ModalContext";

export default function Users() {
  const modal = useModal();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const { data, error: loadError, reload } = useFetch(`/admin/users?status=${status}&q=${encodeURIComponent(q)}&page=${page}`);

  async function toggle(u) {
    const next = u.status === "active" ? "blocked" : "active";
    const isBlocking = next === "blocked";
    const ok = await modal.confirm({
      title: isBlocking ? "Block User" : "Unblock User",
      message: `Are you sure you want to ${isBlocking ? "block" : "unblock"} ${u.name}?`,
      confirmText: isBlocking ? "Block User" : "Unblock User",
      type: isBlocking ? "danger" : "info",
    });
    if (!ok) return;
    try { await api(`/admin/users/${u.id}/status`, { method: "PATCH", body: { status: next } }); reload(); } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <h1 className="font-display text-4xl mb-6">Users</h1>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs items={[["all", "All"], ["active", "Active"], ["blocked", "Blocked"]]} active={status} onChange={(k) => { setStatus(k); setPage(1); }} />
        <SearchBox placeholder="Search users" onSearch={(v) => { setQ(v); setPage(1); }} />
      </div>
      <Card title="Customer accounts">
        {(error || loadError) && <p className="mb-3 text-sm font-bold text-red-800">{error || loadError}</p>}
        {!data ? <p className="text-muted">Loading...</p> : data.items.length === 0 ? <Empty>No users found.</Empty> : (
          <table className="w-full"><thead><tr><Th>Name</Th><Th>Email</Th><Th>Joined</Th><Th>Orders</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>{data.items.map((u) => (
              <tr key={u.id}><Td>{u.name}</Td><Td>{u.email}</Td><Td>{fmtDate(u.joined)}</Td><Td>{u.orders}</Td><Td><Pill s={u.status} /></Td>
                <Td><button className="link" onClick={() => toggle(u)}>{u.status === "active" ? "Block" : "Unblock"}</button></Td></tr>
            ))}</tbody></table>
        )}
      </Card>
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
    </div>
  );
}
