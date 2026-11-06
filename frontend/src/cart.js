import { api } from "./api";

// Tells the header (and any open page) that the cart changed, so the count updates.
export const cartChanged = () => window.dispatchEvent(new Event("uc-cart-changed"));

export async function addToCart(productId, quantity = 1) {
  try {
    const d = await api("/cart/items", { method: "POST", body: { product_id: productId, quantity } });
    cartChanged();
    return { ok: true, message: d.message || "Added to your cart." };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}
