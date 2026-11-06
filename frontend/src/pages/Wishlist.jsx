import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { cartChanged } from "../cart";
import { useWishlist } from "../wishlist";
import ProductCard from "../components/ProductCard";
import { ErrorBox, NoticeBox } from "../components/ui";

export default function Wishlist() {
  const { ids, reload } = useWishlist();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { api("/wishlist").then(setItems).catch((e) => setError(e.message)); }, []);
  const shown = (items || []).filter((p) => ids.has(p.id));     // a removed heart disappears at once

  async function moveAll() {
    setError(""); setMsg("");
    try {
      const r = await api("/wishlist/move-all-to-cart", { method: "POST" });
      await reload();
      setItems(await api("/wishlist"));
      cartChanged();
      setMsg(`${r.moved} moved to your cart.${r.skipped.length ? ` Not moved (unavailable): ${r.skipped.join(", ")}.` : ""}`);
    } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl">Wishlist ({shown.length} {shown.length === 1 ? "item" : "items"})</h1>
        {shown.length > 0 && <button className="btn-outline" onClick={moveAll}>Move all to cart</button>}
      </div>
      <div className="mt-4"><ErrorBox>{error}</ErrorBox><NoticeBox>{msg}</NoticeBox></div>
      {items === null && !error && <p className="mt-6 text-muted">Loading...</p>}
      {items && shown.length === 0 && (
        <div className="card mt-6 p-12 text-center">
          <h2 className="font-display text-3xl">Your wishlist is empty</h2>
          <p className="mt-2 text-muted">Tap the heart on any product to save it here.</p>
          <Link to="/products" className="btn-gold mt-6">Browse products</Link>
        </div>
      )}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{shown.map((p) => <ProductCard key={p.id} p={p} />)}</div>
    </div>
  );
}
