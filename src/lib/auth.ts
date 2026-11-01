
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let initError = false;

export function sb(): SupabaseClient | null {
  if (client || initError) return client;
  const cfg = rawConfig();
  if (!cfg?.url || !cfg?.anon) return null;
  try {
    client = createClient(cfg.url, cfg.anon, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch {
    initError = true;
  }
  return client;
}

function rawConfig(): { url?: string; anon?: string } | null {
  const el = document.getElementById("nr-live-config");
  if (!el) return null;
  try {
    return JSON.parse(el.textContent ?? "{}");
  } catch {
    return null;
  }
}

export async function session(): Promise<Session | null> {
  const c = sb();
  if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    return data.session;
  } catch {
    return null;
  }
}

export async function authHeaders(): Promise<Record<string, string>> {
  const cfg = rawConfig();
  const headers: Record<string, string> = cfg?.anon ? { apikey: cfg.anon } : {};
  const s = await session();
  if (s) headers.authorization = `Bearer ${s.access_token}`;
  return headers;
}

export function displayName(s: Session): string {
  const m = s.user.user_metadata ?? {};
  return m.nickname || m.preferred_username || m.full_name || (s.user.email ?? "voter").split("@")[0];
}

export async function requireAuth(returnTo = location.href): Promise<boolean> {
  const c = sb();
  if (!c) {
    alert("This build has no Supabase backend configured.");
    return false;
  }
  try {
    const { data, error } = await c.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: returnTo },
    });
    if (error) throw error;
    if (data?.url) {

      location.assign(data.url);
      return true;
    }
    alert("Google sign-in returned no URL, check the Supabase provider settings.");
    return false;
  } catch (err) {
    alert(`Google sign-in failed: ${String(err)}`);
    return false;
  }
}

export async function signOut() {
  const c = sb();
  if (c) await c.auth.signOut();
  location.reload();
}

export async function userRole(): Promise<string> {
  const s = await session();
  if (!s) return "";
  try {
    const { data } = await sb()!.rpc("current_role");
    if (typeof data === "string" && data) return data;
  } catch {}
  return (s.user.app_metadata?.role as string) ?? "";
}
