import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

// Keeps the ids of the logged-in customer's wishlist so every heart button knows its state.
const WishContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [ids, setIds] = useState(new Set());

  const reload = useCallback(async () => {
    if (user?.role === "customer") {
      try { setIds(new Set((await api("/wishlist")).map((p) => p.id))); } catch { /* ignore */ }
    } else {
      setIds(new Set());
    }
  }, [user?.id, user?.role]);

  useEffect(() => { reload(); }, [reload]);

  const toggle = async (id) => {
    const has = ids.has(id);
    await api(`/wishlist/${id}`, { method: has ? "DELETE" : "POST" });
    setIds((prev) => { const next = new Set(prev); has ? next.delete(id) : next.add(id); return next; });
    return !has;
  };

  return <WishContext.Provider value={{ ids, toggle, reload }}>{children}</WishContext.Provider>;
}

export const useWishlist = () => useContext(WishContext);
