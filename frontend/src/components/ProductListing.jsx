import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import ProductCard from "./ProductCard";
import Pagination from "./Pagination";
import { ErrorBox } from "./ui";

// One listing used by the category page, search results and "all products".
// Filters live in the URL, so the back button and shared links work.
export default function ProductListing({ categoryId }) {
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const q = params.get("q") || "";
  const catId = categoryId || params.get("category_id") || "";
  const subId = params.get("sub_id") || "";
  const [min, setMin] = useState(params.get("min_price") || "");
  const [max, setMax] = useState(params.get("max_price") || "");

  useEffect(() => { api("/categories", { auth: false }).then(setCats).catch(() => {}); }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (catId) qs.set("category_id", catId);
    ["sub_id", "min_price", "max_price", "rating", "in_stock", "sort", "page"].forEach((k) => { if (params.get(k)) qs.set(k, params.get(k)); });
    setData(null);
    api(`/products?${qs}`, { auth: false }).then(setData).catch((e) => setError(e.message));
  }, [params, categoryId]); // eslint-disable-line

  const set = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: "", ...changes }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  const currentCat = cats.find((c) => String(c.id) === String(catId));
  const title = q ? `Search results for “${q}”` : data?.heading || currentCat?.name || "All products";
  const rating = params.get("rating") || "";

  return (
    <div>
      <h1 className="font-display text-4xl">{title}</h1>
      {data && <p className="mt-1 text-sm text-muted">{data.total} {data.total === 1 ? "product" : "products"}</p>}

      {currentCat && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => set({ sub_id: "" })} className={`rounded-full px-5 py-2 text-sm ${!subId ? "bg-gold font-bold" : "border border-line bg-card"}`}>All {currentCat.name.toLowerCase()}</button>
          {currentCat.children.map((c) => (
            <button key={c.id} onClick={() => set({ sub_id: String(c.id) })} className={`rounded-full px-5 py-2 text-sm ${subId === String(c.id) ? "bg-gold font-bold" : "border border-line bg-card"}`}>{c.name}</button>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="card h-fit p-5 text-sm">
          {!categoryId && (
            <div className="mb-5">
              <p className="mb-2 font-bold">Category</p>
              {cats.map((c) => (
                <label key={c.id} className="mb-1 flex items-center gap-2">
                  <input type="checkbox" checked={String(c.id) === String(catId)} onChange={() => set({ category_id: String(c.id) === String(catId) ? "" : String(c.id), sub_id: "" })} /> {c.name}
                </label>
              ))}
            </div>
          )}
          <p className="mb-2 font-bold">Price</p>
          <div className="mb-5 flex gap-2">
            <input className="input !min-h-[38px] !px-2" placeholder="Min ₹" value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" />
            <input className="input !min-h-[38px] !px-2" placeholder="Max ₹" value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" />
          </div>
          <p className="mb-2 font-bold">Rating</p>
          {[["4", "4 stars and up"], ["3", "3 stars and up"]].map(([v, label]) => (
            <label key={v} className="mb-1 flex items-center gap-2">
              <input type="checkbox" checked={rating === v} onChange={() => set({ rating: rating === v ? "" : v })} /> {label}
            </label>
          ))}
          <p className="mb-2 mt-5 font-bold">Availability</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={params.get("in_stock") === "true"} onChange={(e) => set({ in_stock: e.target.checked ? "true" : "" })} /> In stock only
          </label>
          <button className="btn-dark mt-5 w-full" onClick={() => set({ min_price: min, max_price: max })}>Apply filters</button>
          <button className="link mt-3 block w-full text-center" onClick={() => { setMin(""); setMax(""); setParams(q ? { q } : {}); }}>Clear filters</button>
        </aside>

        <section>
          <div className="mb-4 flex justify-end">
            <select className="input !w-auto !min-h-[40px]" value={params.get("sort") || (q ? "relevance" : "newest")} onChange={(e) => set({ sort: e.target.value })}>
              {q && <option value="relevance">Sort by: Relevance</option>}
              <option value="newest">Sort by: Newest</option>
              <option value="popularity">Sort by: Popularity</option>
              <option value="price_low">Sort by: Price, low to high</option>
              <option value="price_high">Sort by: Price, high to low</option>
              <option value="rating">Sort by: Rating</option>
            </select>
          </div>
          <ErrorBox>{error}</ErrorBox>
          {data === null && !error && <p className="text-muted">Loading...</p>}
          {data && data.items.length === 0 && (
            <div className="card p-10 text-center">
              <h2 className="font-display text-3xl">No results found</h2>
              <p className="mt-2 text-muted">Check the spelling, or try fewer or more general words.</p>
              <Link to="/products" className="btn-gold mt-6">Browse all products</Link>
            </div>
          )}
          {data && data.items.length > 0 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
              <Pagination page={data.page} pages={data.pages} onPage={(n) => { const next = new URLSearchParams(params); next.set("page", String(n)); setParams(next); window.scrollTo(0, 0); }} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
