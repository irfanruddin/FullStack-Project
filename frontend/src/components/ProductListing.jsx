import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import ProductCard from "./ProductCard";
import Pagination from "./Pagination";
import { ErrorBox } from "./ui";

// One listing used by the category page, search results and "all products".
// Filters live in the URL, so the back button and shared links work.
export default function ProductListing({ categoryId }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const q = params.get("q") || "";
  const catParam = params.get("category_id") || "";
  const selectedCatIds = catParam
    ? catParam.split(",").map((s) => s.trim()).filter(Boolean)
    : (categoryId ? [String(categoryId)] : []);
  const catId = categoryId || catParam;
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

  const toggleCategory = (id) => {
    const idStr = String(id);
    let next;
    if (selectedCatIds.includes(idStr)) {
      next = selectedCatIds.filter((x) => x !== idStr);
    } else {
      next = [...selectedCatIds, idStr];
    }

    if (categoryId) {
      if (next.length === 0) {
        navigate(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
      } else {
        navigate(`/products?category_id=${next.join(",")}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      }
    } else {
      set({ category_id: next.join(","), sub_id: "" });
    }
  };

  const clearCategories = () => {
    if (categoryId) {
      navigate(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
    } else {
      set({ category_id: "", sub_id: "" });
    }
  };

  const currentCat = selectedCatIds.length === 1
    ? cats.find((c) => String(c.id) === String(selectedCatIds[0]))
    : null;

  const categoryHeading =
    data?.heading ||
    currentCat?.name ||
    (selectedCatIds.length > 0
      ? cats
          .filter((c) => selectedCatIds.includes(String(c.id)))
          .map((c) => c.name)
          .join(", ")
      : "");

  const title =
    q && categoryHeading
      ? `“${q}” in ${categoryHeading}`
      : q
        ? `Search results for “${q}”`
        : categoryHeading || "All products";
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr] items-start">
        <aside className="card p-5 text-sm lg:sticky lg:top-[88px] self-start">
          <div className="mb-5">
            <div className="mb-2.5 flex items-center justify-between">
              <p className="font-bold text-ink">
                Categories {selectedCatIds.length > 0 && <span className="text-xs font-normal text-gold-dark">({selectedCatIds.length})</span>}
              </p>
              {selectedCatIds.length > 0 && (
                <button
                  type="button"
                  onClick={clearCategories}
                  className="text-xs text-gold-dark hover:underline font-medium"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-1.5 pr-1">
              {cats.map((c) => {
                const isChecked = selectedCatIds.includes(String(c.id));
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-[13px] ${
                      isChecked
                        ? "bg-gold/15 font-semibold text-ink"
                        : "hover:bg-[#F1E6C8]/40 text-body"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCategory(c.id)}
                      className="h-4 w-4 rounded border-line text-gold focus:ring-gold accent-[#D4AF37] cursor-pointer"
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    {c.children && c.children.length > 0 && (
                      <span className="text-[11px] text-muted">
                        ({c.children.length})
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
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
          <button
            className="link mt-3 block w-full text-center"
            onClick={() => {
              setMin("");
              setMax("");
              if (categoryId) {
                navigate(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
              } else {
                setParams(q ? { q } : {});
              }
            }}
          >
            Clear filters
          </button>
        </aside>

        <section className="min-w-0">
          {(q || selectedCatIds.length > 0 || subId || rating || params.get("in_stock")) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted">Active filters:</span>
              {q && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-xs font-medium text-ink">
                  <span>Search: “{q}”</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.delete("q");
                      next.delete("page");
                      setParams(next);
                    }}
                    className="ml-1 text-ink/70 hover:text-ink font-bold text-sm leading-none"
                    aria-label="Remove search filter"
                    title="Remove search keyword"
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedCatIds.map((cid) => {
                const c = cats.find((cat) => String(cat.id) === String(cid));
                const name = c ? c.name : `Category ${cid}`;
                return (
                  <span
                    key={cid}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#F1E6C8] px-3 py-1 text-xs font-medium text-ink border border-line"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => toggleCategory(cid)}
                      className="ml-1 text-ink/70 hover:text-ink font-bold text-sm leading-none"
                      aria-label={`Remove ${name} filter`}
                      title={`Remove ${name}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMin("");
                  setMax("");
                  if (categoryId) {
                    navigate(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
                  } else {
                    setParams(q ? { q } : {});
                  }
                }}
                className="text-xs text-gold-dark hover:underline font-semibold ml-1"
              >
                Reset filters
              </button>
            </div>
          )}
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
              <p className="mt-2 text-muted">
                {q && selectedCatIds.length > 0
                  ? `No products matching “${q}” were found in ${categoryHeading || "the selected categories"}.`
                  : q
                    ? `No products matching “${q}” were found.`
                    : "No products found with the current filters."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {q && selectedCatIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.delete("category_id");
                      next.delete("sub_id");
                      next.delete("page");
                      if (categoryId) {
                        navigate(`/products?q=${encodeURIComponent(q)}`);
                      } else {
                        setParams(next);
                      }
                    }}
                    className="btn-gold"
                  >
                    Search “{q}” in all categories
                  </button>
                )}
                {q && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(params);
                      next.delete("q");
                      next.delete("page");
                      setParams(next);
                    }}
                    className="btn-outline"
                  >
                    Browse {categoryHeading || "this category"}
                  </button>
                )}
                <Link to="/products" className="btn-dark">
                  Browse all products
                </Link>
              </div>
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
