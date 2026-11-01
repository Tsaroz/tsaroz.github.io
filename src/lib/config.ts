
export const SUPABASE_URL = String(import.meta.env.PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
export const SUPABASE_ANON_KEY = String(import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? "");

export const LIVE_API = String(
  import.meta.env.PUBLIC_LIVE_API ??
    (SUPABASE_URL === "" && import.meta.env.DEV ? "http://localhost:8787" : ""),
).replace(/\/$/, "");

export const PANEL_URL = String(import.meta.env.PUBLIC_PANEL_URL ?? "").replace(/\/$/, "");

export const CP = (String(import.meta.env.PUBLIC_CP ?? "/cp-7f3k9q/")).replace(/\/$/, "");

export const IS_SUPABASE = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
export const IS_LIVE = IS_SUPABASE || LIVE_API !== "";
