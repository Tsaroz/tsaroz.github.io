
export type SuggestItem = { t: "Category" | "Ranking" | "Entry"; n: string; u: string; h: string };

let cache: SuggestItem[] | null = null;
let inflight: Promise<SuggestItem[]> | null = null;

function basePath(): string {
  const meta = document.querySelector('meta[name="nr-base"]');
  return (meta?.getAttribute("content") ?? "/").replace(/\/$/, "") + "/";
}

export function loadIndex(): Promise<SuggestItem[]> {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetch(`${basePath()}search-index.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((items: SuggestItem[]) => (cache = items));
  return inflight;
}

export function defaultSuggestions(items: SuggestItem[], limit = 8): SuggestItem[] {
  const seen = new Set<string>();
  return items.filter((it) => it.t === "Ranking" && !seen.has(it.u) && seen.add(it.u)).slice(0, limit);
}

const norm = (s: string) => s.toLowerCase().trim();

export function rank(query: string, items: SuggestItem[], limit = 10): SuggestItem[] {
  const q = norm(query);
  if (!q) return defaultSuggestions(items, limit);
  const words = q.split(/\s+/);
  const scored: Array<[number, SuggestItem]> = [];
  for (const it of items) {
    const name = norm(it.n);
    const hay = `${name} ${norm(it.h)}`;
    let score = 0;
    if (name === q) score += 100;
    if (name.startsWith(q)) score += 60;
    if (name.includes(q)) score += 30;
    for (const w of words) {
      if (name.startsWith(w)) score += 18;
      else if (name.includes(w)) score += 9;
      else if (hay.includes(w)) score += 4;
    }
    if (score <= 0) continue;
    score += it.t === "Ranking" ? 6 : it.t === "Category" ? 3 : 0;
    scored.push([score, it]);
  }
  return scored
    .sort((a, b) => b[0] - a[0] || a[1].n.length - b[1].n.length)
    .slice(0, limit)
    .map(([, it]) => it);
}

export interface SuggestUi {
  input: HTMLInputElement;
  list: HTMLElement;
  wrap: HTMLElement;
  onNavigate?: (item: SuggestItem) => void;
}

export function mountSuggest({ input, list, wrap, onNavigate }: SuggestUi) {
  let items: SuggestItem[] = [];
  let active = -1;
  let lastQuery: string | null = null;

  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
  const icon = (t: string) =>
    t === "Ranking" ? "☷" : t === "Category" ? "▦" : "◆";

  function render() {
    const live = wrap.querySelector<HTMLElement>("[data-suggest-count]");
    if (!items.length) {
      list.innerHTML = `<p class="px-3 py-2.5 text-sm text-ink-700">No matches, try “bank”, “momo”, “Pokhara”.</p>`;
      if (live) live.textContent = "No matches found";
      list.classList.remove("hidden");
      wrap.dataset.open = "1";
      return;
    }
    if (live) live.textContent = `${items.length} suggestions`;
    list.innerHTML = items
      .map(
        (it, i) =>
          `<a class="nr-suggest-item" data-i="${i}" href="${esc(it.u)}">` +
          `<span class="w-5 shrink-0 text-center text-ink-400" aria-hidden="true">${icon(it.t)}</span>` +
          `<span class="min-w-0 flex-1"><span class="block truncate font-semibold text-ink-900">${esc(it.n)}</span>` +
          `<span class="block truncate text-xs text-ink-600">${esc(it.t)} · ${esc(it.h)}</span></span></a>`,
      )
      .join("");
    list.classList.remove("hidden");
    wrap.dataset.open = "1";
    active = -1;
  }

  async function update(query: string) {
    const all = await loadIndex();
    items = rank(query, all);
    render();
  }

  function setActive(i: number) {
    const links = [...list.querySelectorAll<HTMLElement>(".nr-suggest-item")];
    links.forEach((l) => l.removeAttribute("data-active"));
    active = (i + links.length) % links.length;
    links[active]?.setAttribute("data-active", "");
    links[active]?.scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("focus", () => void update(input.value));
  input.addEventListener("input", () => {
    if (input.value === lastQuery) return;
    lastQuery = input.value;
    void update(input.value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Escape") { list.classList.add("hidden"); wrap.dataset.open = ""; }
    else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      const it = items[active];
      if (it) {
        list.classList.add("hidden");
        onNavigate ? onNavigate(it) : (location.href = it.u);
      }
    }
  });
  input.addEventListener("blur", () => setTimeout(() => (list.classList.add("hidden"), (wrap.dataset.open = "")), 120));
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target as Node)) {
      list.classList.add("hidden");
      wrap.dataset.open = "";
    }
  });
}
