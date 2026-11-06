import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, imageUrl } from "../api";
import { cartChanged } from "../cart";
import { useWishlist } from "../wishlist";
import Steps from "../components/Steps";
import { ErrorBox } from "../components/ui";

const tints = ["#F1E6C8", "#E8D9A8", "#EDE4CF", "#DDD0B0"];
const inr = (n) => `₹ ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function Cart() {
  const navigate = useNavigate();
  const { reload: reloadWishlist } = useWishlist();
  const [cart, setCart] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api("/cart").then(setCart).catch((e) => setError(e.message)); }, []);

  async function run(promise) {
    setError("");
    try { setCart(await promise); cartChanged(); } catch (e) { setError(e.message); }
  }
  const change = (item, qty) => run(api(`/cart/items/${item.id}`, { method: "PUT", body: { quantity: qty } }));
  const remove = (item) => run(api(`/cart/items/${item.id}`, { method: "DELETE" }));
  const toWishlist = async (item) => { await run(api(`/cart/items/${item.id}/move-to-wishlist`, { method: "POST" })); reloadWishlist(); };

  if (!cart) return <p className="text-muted">{error || "Loading..."}</p>;

  if (cart.items.length === 0) {
    return (
      <div>
        <h1 className="font-display text-4xl">Shopping cart (0 items)</h1>
        <div className="card mt-6 p-12 text-center">
          <h2 className="font-display text-3xl">Your cart is empty</h2>
          <p className="mt-2 text-muted">Add products you like and they will show up here.</p>
          <Link to="/products" className="btn-gold mt-6">Continue shopping</Link>
        </div>
      </div>
    );
  }

  const sellers = cart.groups.length;
  const canCheckout = cart.items.some((i) => !i.problem) && !cart.has_problems;

  return (
    <div>
      <Steps current={1} />
      <h1 className="font-display text-4xl">Shopping cart ({cart.count} {cart.count === 1 ? "item" : "items"})</h1>
      <ErrorBox>{error}</ErrorBox>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="card divide-y divide-line">
          {cart.items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-start gap-4 p-5">
              <Link to={`/products/${item.product_id}`} className="block h-20 w-20 shrink-0 overflow-hidden rounded-lg" style={{ background: tints[item.product_id % 4] }}>
                {item.image && <img src={imageUrl(item.image)} alt="" className="h-full w-full object-cover" />}
              </Link>
              <div className="min-w-[180px] flex-1">
                <Link to={`/products/${item.product_id}`} className="font-bold">{item.name}</Link>
                <p className="text-sm text-muted">Sold by {item.seller_name}</p>
                {item.problem
                  ? <p className="mt-1 text-sm font-bold text-red-700">{item.problem.message} Remove it to continue.</p>
                  : item.stock_status === "low_stock" && <p className="mt-1 text-sm font-bold text-red-700">Only {item.stock} left</p>}
                <div className="mt-2 flex gap-4 text-sm">
                  <button className="link" onClick={() => remove(item)}>Remove</button>
                  <button className="link" onClick={() => toWishlist(item)}>Move to wishlist</button>
                </div>
              </div>
              <div className="inline-flex items-center rounded-lg border border-line bg-card">
                <button className="h-10 w-10" onClick={() => change(item, item.quantity - 1)} disabled={item.quantity <= 1 || !!item.problem}>−</button>
                <span className="w-8 text-center">{item.quantity}</span>
                <button className="h-10 w-10" onClick={() => change(item, item.quantity + 1)} disabled={!!item.problem}>+</button>
              </div>
              <p className="w-24 text-right text-lg font-bold">{inr(item.line_total)}</p>
            </div>
          ))}
        </div>

        <aside className="card h-fit p-6">
          <h2 className="font-display text-2xl mb-4">Order summary</h2>
          <dl className="space-y-2 text-[15px]">
            <div className="flex justify-between"><dt className="text-muted">Items subtotal</dt><dd>{inr(cart.totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Tax</dt><dd>{inr(cart.totals.tax)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd>{cart.totals.delivery ? inr(cart.totals.delivery) : "Free"}</dd></div>
          </dl>
          <div className="my-4 border-t border-line" />
          <div className="flex justify-between text-xl font-bold"><span>Total</span><span>{inr(cart.totals.total)}</span></div>
          {sellers > 1 && <p className="mt-3 text-xs text-muted">Your items are from {sellers} sellers, so they are delivered as {sellers} separate orders.</p>}
          <button className="btn-gold mt-5 w-full min-h-[50px]" disabled={!canCheckout} onClick={() => navigate("/checkout")}>Proceed to checkout</button>
          {cart.has_problems && <p className="mt-3 text-xs font-bold text-red-700">Remove the unavailable items to continue.</p>}
          <p className="mt-3 text-xs text-muted">Cash on delivery available. Stock is checked before your order is confirmed.</p>
          <Link to="/products" className="link mt-4 block text-center text-sm">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
