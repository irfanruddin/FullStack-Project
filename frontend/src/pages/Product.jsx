import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, imageUrl } from "../api";
import { useAuth } from "../auth";
import { useWishlist } from "../wishlist";
import { addToCart } from "../cart";
import { Stars } from "../components/Stars";
import ProductCard, { Heart } from "../components/ProductCard";
import { ErrorBox, NoticeBox } from "../components/ui";

const tints = ["#F1E6C8", "#E8D9A8", "#EDE4CF", "#DDD0B0"];

export default function Product() {
  const { id } = useParams();
  const { user } = useAuth();
  const { ids, toggle } = useWishlist();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [pic, setPic] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setP(null); setError(""); setQty(1); setPic(0);
    api(`/products/${id}`).then(setP).catch((e) => setError(e.message));
    api(`/products/${id}/reviews`, { auth: false }).then(setReviews).catch(() => {});
    window.scrollTo(0, 0);
  }, [id]);

  if (error) return <div className="card p-10 text-center"><h1 className="font-display text-3xl">{error}</h1><Link to="/products" className="btn-gold mt-6">Browse products</Link></div>;
  if (!p) return <p className="text-muted">Loading...</p>;

  const wished = ids.has(p.id);
  const out = p.stock_status === "out_of_stock";
  const maxQty = Math.max(1, Math.min(p.stock, 10));
  const needLogin = () => navigate("/login", { state: { from: `/products/${p.id}` } });
  const images = p.images.map(imageUrl);
  const stockLabel = { in_stock: ["In stock", "bg-[#DCEFD9] text-green-800"], low_stock: [`Only ${p.stock} left`, "bg-[#F4D3D0] text-red-800"], out_of_stock: ["Out of stock", "bg-line text-muted"] }[p.stock_status];

  async function onAdd() {
    if (!user) return needLogin();
    const r = await addToCart(p.id, qty);
    setMsg(r.message);
  }
  async function onWish() {
    if (!user) return needLogin();
    if (user.role !== "customer") return;
    try { await toggle(p.id); } catch (e) { setMsg(e.message); }
  }

  const summary = reviews?.summary || p.rating_summary;

  return (
    <div>
      <p className="mb-4 text-xs text-muted">
        <Link to="/">Home</Link>
        {p.parent_category && <> / <Link to={`/category/${p.parent_category.id}`}>{p.parent_category.name}</Link></>}
        {" / "}{p.name}
      </p>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-xl" style={{ background: tints[p.id % 4] }}>
            {images[pic] ? <img src={images[pic]} alt={p.name} className="h-full w-full object-cover" /> :
              <span className="absolute inset-0 flex items-center justify-center text-sm text-muted">No image yet</span>}
            <button onClick={onWish} aria-label="Wishlist" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-card"><Heart filled={wished} /></button>
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {images.map((src, n) => <button key={src} onClick={() => setPic(n)} className={`aspect-square overflow-hidden rounded-lg border-2 ${n === pic ? "border-gold" : "border-transparent"}`}><img src={src} alt="" className="h-full w-full object-cover" /></button>)}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-display text-4xl">{p.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            <Stars value={p.avg_rating} count={p.review_count} />
            <span className="font-bold text-gold-dark">Sold by {p.seller.shop_name}</span>
          </div>
          <p className="mt-5 text-4xl font-bold">₹ {p.price.toLocaleString("en-IN")}</p>
          <p className="text-sm text-muted">Inclusive of all taxes</p>
          <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${stockLabel[1]}`}>{stockLabel[0]}</span>

          <div className="mt-6">
            <p className="label">Quantity</p>
            <div className="inline-flex items-center rounded-lg border border-line bg-card">
              <button className="h-11 w-11" onClick={() => setQty(Math.max(1, qty - 1))} disabled={out}>−</button>
              <span className="w-10 text-center font-medium">{qty}</span>
              <button className="h-11 w-11" onClick={() => setQty(Math.min(maxQty, qty + 1))} disabled={out}>+</button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button className="btn-gold min-h-[52px]" onClick={onAdd} disabled={out}>{out ? "Out of stock" : "Add to cart"}</button>
            <button className="btn-outline min-h-[52px]" onClick={onWish}>{wished ? "Remove from wishlist" : "Add to wishlist"}</button>
          </div>
          <div className="mt-4"><NoticeBox>{msg}</NoticeBox></div>

          <ul className="card mt-6 space-y-2 p-5 text-sm">
            <li>Free delivery above ₹{p.free_delivery_above}</li>
            <li>Cash on delivery available</li>
            <li>Easy returns within {p.return_window_days} days of delivery</li>
          </ul>
        </div>
      </div>

      <section className="card mt-10 p-6">
        <h2 className="font-display text-2xl">About this product</h2>
        <p className="mt-3 whitespace-pre-line text-body">{p.description || "No description yet."}</p>
      </section>

      <section className="mt-12">
        <h2 className="mb-5 font-display text-3xl">Customer reviews</h2>
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="card h-fit p-6">
            <p className="font-display text-5xl font-bold">{summary.average || "–"}</p>
            <Stars value={summary.average} big />
            <p className="mt-1 text-sm text-muted">{summary.count} {summary.count === 1 ? "review" : "reviews"}</p>
            <div className="mt-4 space-y-2">
              {[5, 4, 3, 2, 1].map((n) => (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-12">{n} stars</span>
                  <div className="h-2.5 flex-1 rounded-full bg-line"><div className="h-2.5 rounded-full bg-gold" style={{ width: `${summary.count ? (summary.breakdown[n] / summary.count) * 100 : 0}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="mt-5 text-sm">
              {p.me?.can_review && <Link to={`/products/${p.id}/review`} className="btn-gold w-full">Write a review</Link>}
              {p.me?.has_reviewed && <p className="text-muted">You have reviewed this product.</p>}
              {!p.me?.can_review && !p.me?.has_reviewed && <p className="text-muted">Only customers who bought this product can review it.</p>}
            </div>
          </div>
          <div className="space-y-4">
            {reviews && reviews.items.length === 0 && <div className="card p-6 text-muted">No reviews yet.</div>}
            {reviews?.items.map((r) => (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{r.name} <span className="ml-2 rounded-full bg-[#DCEFD9] px-2 py-0.5 text-xs text-green-800">Verified buyer</span></p>
                  <Stars value={r.rating} />
                </div>
                {r.title && <p className="mt-2 font-medium">{r.title}</p>}
                {r.body && <p className="mt-1 text-sm text-muted">{r.body}</p>}
                <p className="mt-2 text-xs text-muted">{new Date(r.created_at).toLocaleDateString("en-IN")}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {p.related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 font-display text-3xl">You may also like</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{p.related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
        </section>
      )}
    </div>
  );
}
