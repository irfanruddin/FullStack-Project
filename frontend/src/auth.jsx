import { createContext, useContext, useEffect, useState } from "react";
import { api, tokens } from "./api";

const AuthContext = createContext(null);
const toUser = (d) => ({ ...d.user, seller_status: d.seller_status });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On page load, ask the server who is logged in
  useEffect(() => {
    if (!tokens.access) {
      setLoading(false);
      return;
    }
    api("/auth/me")
      .then((d) => setUser(toUser(d)))
      .catch(() => tokens.clear())
      .finally(() => setLoading(false));
  }, []);

  // path is "/auth/login" or "/auth/admin/login"
  const login = async (path, payload) => {
    const d = await api(path, { method: "POST", body: payload, auth: false });
    tokens.save(d.access_token, d.refresh_token, !!payload.remember_me);
    setUser(toUser(d));
    return d;
  };

  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    tokens.clear();
    setUser(null);
  };

  const reload = async () => setUser(toUser(await api("/auth/me")));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, reload }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
