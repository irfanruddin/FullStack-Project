import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

// Keeps the number of items in the cart for the header badge.
const CartContext = createContext({ count: 0, refresh: () => {} });

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (user?.role === "customer") {
      api("/cart").then((c) => setCount(c.count)).catch(() => {});
    } else {
      setCount(0);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    refresh();
    window.addEventListener("uc-cart-changed", refresh);
    return () => window.removeEventListener("uc-cart-changed", refresh);
  }, [refresh]);

  return <CartContext.Provider value={{ count, refresh }}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
