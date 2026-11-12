// One place that talks to the backend. Adds the token, and refreshes it once if it expired.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const tokens = {
  get access() {
    return (
      localStorage.getItem("uc_access") || sessionStorage.getItem("uc_access")
    );
  },
  get refresh() {
    return (
      localStorage.getItem("uc_refresh") || sessionStorage.getItem("uc_refresh")
    );
  },
  save(access, refresh, remember) {
    this.clear();
    const store = remember ? localStorage : sessionStorage; // "Keep me logged in" uses localStorage
    store.setItem("uc_access", access);
    store.setItem("uc_refresh", refresh);
  },
  setAccess(access) {
    const store = localStorage.getItem("uc_refresh")
      ? localStorage
      : sessionStorage;
    store.setItem("uc_access", access);
  },
  clear() {
    ["uc_access", "uc_refresh"].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  },
};

function errorMessage(data) {
  if (!data) return "Something went wrong. Please try again.";
  if (typeof data.detail === "string") return data.detail;
  if (data.detail && !Array.isArray(data.detail) && data.detail.message)
    return data.detail.message;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((d) => (d.msg || "").replace(/^Value error, /, ""))
      .join(" ");
  }
  return "Something went wrong. Please try again.";
}

async function send(
  path,
  { method = "GET", body, auth = true, form = false } = {},
) {
  const headers = {};
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  if (body && !form) headers["Content-Type"] = "application/json";
  return fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  });
}

export async function api(path, opts = {}) {
  let res;
  try {
    res = await send(path, opts);
  } catch {
    throw {
      status: 0,
      message: "Cannot reach the server. Is the backend running?",
    };
  }
  if (res.status === 401 && opts.auth !== false && tokens.refresh) {
    const r = await send("/auth/refresh", {
      method: "POST",
      body: { refresh_token: tokens.refresh },
      auth: false,
    });
    if (r.ok) {
      tokens.setAccess((await r.json()).access_token);
      res = await send(path, opts);
    } else {
      tokens.clear();
    }
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok)
    throw {
      status: res.status,
      message: errorMessage(data),
      data: data ? data.detail : null,
    };
  return data;
}

// Product images are served by the backend from /uploads
export const imageUrl = (path) => {
  if (!path) return null;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${BASE.replace(/\/api\/v1$/, "")}/uploads/${path}`;
};

// Downloads a file that needs the login token (for example an invoice)
export async function downloadFile(path, filename) {
  await api("/auth/me"); // makes sure the token is fresh
  const res = await send(path);
  if (!res.ok)
    throw { status: res.status, message: "Could not download the file." };
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
