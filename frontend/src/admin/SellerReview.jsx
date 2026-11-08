import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Card, Pill, fetchBlob, fmtDate, label, useFetch } from "./adminUi";
import { ErrorBox, NoticeBox } from "../components/ui";

// Shows an uploaded document. The file needs the login token, so it is fetched and shown from memory.
function Doc({ sellerId, doc }) {
  const [url, setUrl] = useState(null);
  const [type, setType] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let objectUrl;
    fetchBlob(`/admin/sellers/${sellerId}/documents/${doc.id}`)
      .then((b) => { objectUrl = URL.createObjectURL(b); setUrl(objectUrl); setType(b.type); })
      .catch(() => setFailed(true));
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [sellerId, doc.id]);
  return (
    <div>
      <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg bg-[#E8D9A8]">
        {failed ? <span className="text-sm text-muted">File not found</span>
          : !url ? <span className="text-sm text-muted">Loading...</span>
          : type.startsWith("image/") ? <img src={url} alt={doc.kind} className="h-full w-full object-cover" />
          : <a href={url} target="_blank" rel="noreferrer" className="link">Open {doc.name || "file"}</a>}
      </div>
      <p className="mt-1 text-center text-xs text-muted">{label(doc.kind)}</p>
    </div>
  );
}

export default function SellerReview() {
  const { id } = useParams();
  const { data: s, error, reload } = useFetch(`/admin/sellers/${id}`);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  if (error) return <p className="text-red-800">{error}</p>;
  if (!s) return <p className="text-muted">Loading...</p>;

  async function act(path, body, ok) {
    setMsg(""); setErr("");
    try { await api(`/admin/sellers/${id}/${path}`, { method: "PATCH", body }); setMsg(ok); setReason(""); reload(); } catch (e) { setErr(e.message); }
  }
  const Row = ({ k, v }) => <div className="mb-3"><p className="text-xs text-muted">{k}</p><p className="font-medium">{v || "–"}</p></div>;

  return (
    <div>
      <p className="text-xs text-muted"><Link to="/admin/sellers">Sellers</Link> / {s.shop.name}</p>
      <h1 className="font-display text-4xl">Seller application</h1>
      <div className="mb-5 mt-2"><Pill s={s.status} /></div>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Card title="Seller details">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <Row k="Name" v={s.owner.name} /><Row k="Email" v={s.owner.email} /><Row k="Phone" v={s.owner.phone} />
              <Row k="Shop name" v={s.shop.name} /><Row k="Category" v={s.shop.category} /><Row k="Pickup address" v={s.shop.pickup_address} />
            </div>
            <Row k="Shop description" v={s.shop.description} />
          </Card>
          <Card title="Documents">
            {s.documents.length === 0 ? <p className="text-muted">No documents uploaded.</p>
              : <div className="grid gap-5 sm:grid-cols-2">{s.documents.map((d) => <Doc key={d.id} sellerId={s.id} doc={d} />)}</div>}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Decision">
            <NoticeBox>{msg}</NoticeBox><ErrorBox>{err}</ErrorBox>
            {s.status === "pending" && (
              <>
                <label className="label">Reason (required to reject)</label>
                <textarea className="input min-h-[110px] py-3" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Write what the seller needs to fix" />
                <button className="btn-gold mt-4 w-full" onClick={() => act("approve", undefined, "Seller approved. They have been emailed.")}>Approve seller</button>
                <button className="btn-outline mt-3 w-full" onClick={() => act("reject", { reason }, "Application rejected. The seller has been emailed.")}>Reject application</button>
                <p className="mt-3 text-xs text-muted">The seller is told your decision by email.</p>
              </>
            )}
            {s.status === "rejected" && (<><p className="mb-3 text-sm text-muted">Rejected. The seller can correct the application and apply again. You can still approve it.</p>
              <button className="btn-gold w-full" onClick={() => act("approve", undefined, "Seller approved.")}>Approve seller</button></>)}
            {s.status === "approved" && (<><p className="mb-3 text-sm text-muted">Blocking hides all this seller's products from customers.</p>
              <button className="btn-outline w-full" onClick={() => window.confirm("Block this seller?") && act("status", { status: "blocked" }, "Seller blocked.")}>Block seller</button></>)}
            {s.status === "blocked" && (<button className="btn-gold w-full" onClick={() => act("status", { status: "approved" }, "Seller unblocked.")}>Unblock seller</button>)}
          </Card>
          <Card title="History">
            <p className="text-sm text-muted">Applied {fmtDate(s.applied_at)}</p>
            {s.approved_at && <p className="text-sm text-muted">Approved {fmtDate(s.approved_at)}</p>}
            <p className="text-sm text-muted">Products listed: {s.products}</p>
            {s.reject_reason && <p className="mt-2 text-sm"><span className="font-bold">Last reason:</span> {s.reject_reason}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
