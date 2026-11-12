import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { imageUrl } from "../api";
import { useAuth } from "../auth";
import { useWishlist } from "../wishlist";
import { addToCart } from "../cart";
import { Stars } from "./Stars";

const tints = ["#F1E6C8", "#E8D9A8", "#EDE4CF", "#DDD0B0"];
const tags = {
  in_stock: ["In stock", "text-green-700"],
  low_stock: ["Low stock", "text-red-700"],
  out_of_stock: ["Out of stock", "text-muted"],
};

export function Heart({ filled }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? "#D4AF37" : "none"}
      stroke="#000"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

export default function ProductCard({ p }) {
  const { user } = useAuth();
  const { ids, toggle } = useWishlist();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("");
  const wished = ids.has(p.id);
  const [tagText, tagColor] = tags[p.stock_status];
  const img = imageUrl(p.image);
  console.log("Original image path:", p.image);
  console.log("Generated image URL:", img);

  const needLogin = () =>
    navigate("/login", { state: { from: `/products/${p.id}` } });

  async function onHeart(e) {
    e.preventDefault();
    if (!user) return needLogin();
    if (user.role !== "customer") return;
    try {
      await toggle(p.id);
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onAdd() {
    if (!user) return needLogin();
    const r = await addToCart(p.id);
    setMsg(r.message);
    setTimeout(() => setMsg(""), 2500);
  }

  return (
    <article className="card flex flex-col p-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
      <Link
        to={`/products/${p.id}`}
        className="relative block aspect-[4/3] overflow-hidden rounded-lg"
        style={{ background: tints[p.id % 4] }}
      >
        {img && (
          <img src={img} alt={p.name} className="h-full w-full object-cover" />
        )}
        <span
          className={`absolute left-3 top-3 rounded bg-card px-2 py-0.5 text-xs font-bold ${tagColor}`}
        >
          {tagText}
        </span>
        <button
          onClick={onHeart}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <Heart filled={wished} />
        </button>
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link to={`/products/${p.id}`} className="font-bold leading-snug">
          {p.name}
        </Link>
        <Stars value={p.avg_rating} count={p.review_count} />
        <p className="text-xs text-muted">Sold by {p.seller_name}</p>
        <p className="mt-1 text-xl font-bold">
          ₹ {p.price.toLocaleString("en-IN")}
        </p>
        <button
          onClick={onAdd}
          disabled={p.stock_status === "out_of_stock"}
          className="btn-gold mt-2 w-full"
        >
          {p.stock_status === "out_of_stock" ? "Out of stock" : "Add to cart"}
        </button>
        {msg && <p className="text-xs text-muted">{msg}</p>}
      </div>
    </article>
  );
}
