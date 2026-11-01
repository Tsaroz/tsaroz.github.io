
export const CONTENT_API = "http://127.0.0.1:8788";
export const LIVE_API = "http://localhost:8787";

export function getToken(): string {
  return localStorage.getItem("nr.admin.token") ?? "dev-admin-token";
}

export async function contentApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${CONTENT_API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-admin-token": getToken(), ...(init.headers ?? {}) },
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export async function liveAdmin<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${LIVE_API}${path}${sep}token=${encodeURIComponent(getToken())}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

let toastTimer: number | undefined;
export function adminToast(msg: string, ok = true) {
  let el = document.getElementById("nr-admin-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "nr-admin-toast";
    document.body.appendChild(el);
  }
  el.className =
    "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-card " +
    (ok ? "border-up-500 bg-up-50 text-up-700" : "border-down-500 bg-down-50 text-down-700");
  el.textContent = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.add("hidden"), 3200);
}

export function sbUrl(): string {
  return (document.querySelector('meta[name="nr-supabase"]')?.getAttribute("content") ?? "").replace(/\/$/, "");
}
export function sbKey(): string {
  return localStorage.getItem("nr.supabase.service") ?? "";
}
export function sbConfigured(): boolean {
  return sbUrl() !== "" && sbKey().length > 20;
}

export async function sb<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${sbUrl()}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: sbKey(),
      authorization: `Bearer ${sbKey()}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).message ?? msg; } catch {}
    throw new Error(msg);
  }
  return res.status === 204 || (res.headers.get("content-length") === "0")
    ? (undefined as T)
    : ((await res.json()) as T);
}

export type SbComment = { id: string; entry_id: string; author: string; body: string; created_at: string; status: string; device_id?: string; email?: string; user_id?: string };
