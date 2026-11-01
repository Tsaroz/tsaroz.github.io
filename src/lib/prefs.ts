
export type Theme = "light" | "dark" | "auto";
export type Font = "default" | "serif" | "grotesk" | "mono";
export type Size = "sm" | "md" | "lg" | "xl";

export interface Prefs {
  theme: Theme;
  font: Font;
  size: Size;
}

export const DEFAULTS: Prefs = { theme: "auto", font: "default", size: "md" };

const KEY = "nr.prefs";

export function readPrefs(): Partial<Prefs> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>;
  } catch {
    return {};
  }
}

export function savePrefs(patch: Partial<Prefs>) {
  const next = { ...readPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function effectiveTheme(prefs: Partial<Prefs>, fallback: Theme = DEFAULTS.theme): Theme {
  const t = prefs.theme ?? fallback;
  return t === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
}

export function applyPrefs(patch?: Partial<Prefs>) {
  const p = patch ? (savePrefs(patch), readPrefs()) : readPrefs();
  const el = document.documentElement;
  el.setAttribute("data-theme", effectiveTheme(p));
  el.setAttribute("data-font", p.font ?? DEFAULTS.font);
  el.setAttribute("data-size", p.size ?? DEFAULTS.size);
}

export function syncControls() {
  const p = { ...DEFAULTS, ...readPrefs() };
  document.querySelectorAll<HTMLElement>("[data-theme-choice]").forEach((b) => {
    const on = b.dataset.themeChoice === p.theme;
    b.classList.toggle("border-brand-600", on);
    b.classList.toggle("bg-brand-50", on);
    b.classList.toggle("text-brand-700", on);
    b.setAttribute("aria-checked", String(on));
  });
  document.querySelectorAll<HTMLElement>("[data-size-choice]").forEach((b) => {
    const on = b.dataset.sizeChoice === p.size;
    b.classList.toggle("border-brand-600", on);
    b.classList.toggle("bg-brand-50", on);
    b.classList.toggle("text-brand-700", on);
    b.setAttribute("aria-checked", String(on));
  });
  const sel = document.querySelector<HTMLSelectElement>("[data-font-choice]");
  if (sel) sel.value = p.font;
}

if (matchMedia) {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    const p = readPrefs();
    if ((p.theme ?? DEFAULTS.theme) === "auto") {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    }
  });
}
