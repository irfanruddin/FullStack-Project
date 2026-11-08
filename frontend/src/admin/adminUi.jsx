import { useCallback, useEffect, useState } from "react";
import { api, tokens } from "../api";

export const inr = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
export const label = (s) => (s || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

// Loads a path from the API. Changing the path (filters, page) loads again.
export function useFetch(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => { setError(""); return api(path).then(setData).catch((e) => setError(e.message)); }, [path]);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load };
}

// Files that need the login token (seller documents)
export async function fetchBlob(path) {
  await api("/auth/me");
  const base = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
  const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${tokens.access}` } });
  if (!res.ok) throw new Error("File not found");
  return res.blob();
}

const tones = {
  green: "bg-[#DCEFD9] text-green-800", yellow: "bg-[#F3E2A5] text-gold-dark",
  red: "bg-[#F4D3D0] text-red-800", grey: "bg-line text-body",
};
const toneOf = {
  active: "green", approved: "green", shipped: "green", delivered: "green", refunded: "green",
  pending: "yellow", requested: "yellow", shipped_back: "yellow", received: "yellow",
  blocked: "red", rejected: "red", cancelled: "red", refund_owed: "red", placed: "grey", confirmed: "grey",
};
export const Pill = ({ s }) => <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${tones[toneOf[s] || "grey"]}`}>{label(s)}</span>;

export function Tabs({ items, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([key, text]) => (
        <button key={key} onClick={() => onChange(key)}
          className={`rounded-full px-5 py-2 text-sm ${active === key ? "bg-gold font-bold" : "border border-line bg-card"}`}>{text}</button>
      ))}
    </div>
  );
}

export function SearchBox({ placeholder, onSearch }) {
  const [v, setV] = useState("");
  useEffect(() => { const t = setTimeout(() => onSearch(v), 400); return () => clearTimeout(t); }, [v]); // eslint-disable-line
  return <input className="input !min-h-[40px] !w-64" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />;
}

export function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-5 flex gap-2">
      {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map((n) => (
        <button key={n} onClick={() => onPage(n)} className={`h-10 min-w-[40px] rounded-lg px-3 text-sm ${n === page ? "bg-gold font-bold" : "border border-line bg-card"}`}>{n}</button>
      ))}
      {page < pages && <button onClick={() => onPage(page + 1)} className="h-10 rounded-lg border border-line bg-card px-4 text-sm font-bold">Next</button>}
    </div>
  );
}

export const Card = ({ title, right, children, className = "" }) => (
  <section className={`card p-6 ${className}`}>
    {(title || right) && <div className="mb-4 flex items-baseline justify-between"><h2 className="font-display text-2xl">{title}</h2>{right}</div>}
    {children}
  </section>
);

export const Kpi = ({ title, value }) => (
  <div className="card p-5"><p className="text-sm text-muted">{title}</p><p className="mt-1 font-display text-3xl font-bold">{value}</p></div>
);

export const Th = ({ children, className = "" }) => <th className={`border-b border-line py-3 pr-4 text-left text-xs font-bold text-muted ${className}`}>{children}</th>;
export const Td = ({ children, className = "" }) => <td className={`border-b border-line py-3 pr-4 text-sm ${className}`}>{children}</td>;
export const Empty = ({ children }) => <p className="py-8 text-center text-muted">{children}</p>;

// Simple bar chart. The highest bar is gold.
export function BarChart({ series, height = 180 }) {
  const max = Math.max(1, ...series.map((p) => p.value));
  const top = series.findIndex((p) => p.value === max);
  return (
    <div>
      <p className="mb-1 text-xs text-muted">Highest: {inr(max)}</p>
      <div className="flex items-end gap-1 border-b border-line" style={{ height }}>
        {series.map((p, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }} title={`${p.label}: ${inr(p.value)}`}>
            <div className={`w-3/5 rounded-t ${max > 1 && i === top ? "bg-gold" : "bg-ink"}`} style={{ height: `${(p.value / max) * 100}%`, minHeight: p.value ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-muted">{series.map((p, i) => <span key={i} className="flex-1 truncate text-center">{series.length > 14 && i % 3 ? "" : p.label}</span>)}</div>
    </div>
  );
}
