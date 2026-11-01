import { session, authHeaders, requireAuth, displayName } from "@lib/auth";

const VOTES_PER_SITE = 3;
const VOTES_PER_RANKING = 1;

export interface LiveConfig {
  mode: "supabase" | "api";
  url: string;
  anon?: string;
}

export interface VoteDelta {
  up: number;
  down: number;
}

type Ledger = Record<string, { dir: "up" | "down"; ts: number; categoryId: string; rankingId?: string }>;

const DAY = 24 * 60 * 60 * 1000;

export function liveConfig(): LiveConfig | null {
  const el = document.getElementById("nr-live-config");
  if (!el) return null;
  try {
    const cfg = JSON.parse(el.textContent ?? "{}") as { url?: string; anon?: string; api?: string };
    if (cfg.url && cfg.anon) return { mode: "supabase", url: cfg.url.replace(/\/$/, ""), anon: cfg.anon };
    if (cfg.api) return { mode: "api", url: cfg.api.replace(/\/$/, "") };
    return null;
  } catch {
    return null;
  }
}

async function headersFor(cfg: LiveConfig, json = false): Promise<Record<string, string>> {
  const h: Record<string, string> = json ? { "content-type": "application/json" } : {};
  if (cfg.mode === "supabase") Object.assign(h, await authHeaders());
  return h;
}

async function jsonGet(cfg: LiveConfig, path: string): Promise<unknown> {
  const res = await fetch(cfg.url + path, { headers: await headersFor(cfg) });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

function deviceId(): string {
  let id = localStorage.getItem("nr.device");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
    localStorage.setItem("nr.device", id);
  }
  return id;
}

function ledger(): Ledger {
  try {
    return JSON.parse(localStorage.getItem("nr.votes") ?? "{}") as Ledger;
  } catch {
    return {};
  }
}

function saveLedger(l: Ledger) {
  localStorage.setItem("nr.votes", JSON.stringify(l));
}

function recentVotesIn(l: Ledger, key: "categoryId" | "rankingId", value: string, excludeEntryId: string): number {
  const now = Date.now();
  return Object.entries(l).filter(
    ([entryId, v]) => entryId !== excludeEntryId && now - v.ts < DAY && (key === "rankingId" ? v.rankingId === value : v.categoryId === value && !v.rankingId),
  ).length;
}

function siteVotesUsed(l: Ledger, excludeEntryId: string): number {
  const now = Date.now();
  return Object.entries(l).filter(([entryId, v]) => entryId !== excludeEntryId && now - v.ts < DAY).length;
}

function restoredState(group: HTMLElement, l: Ledger) {
  const id = group.dataset.entryId!;
  const rec = l[id];
  if (!rec || Date.now() - rec.ts >= DAY) return;
  const btn = group.querySelector<HTMLButtonElement>(`[data-vote="${rec.dir}"]`);
  if (!btn) return;
  markVoted(group, btn, rec.dir);
}

function markVoted(group: HTMLElement, btn: HTMLButtonElement, dir: "up" | "down") {
  group.querySelectorAll<HTMLButtonElement>("[data-vote]").forEach((b) => {
    b.setAttribute("aria-pressed", "false");
    b.classList.remove(
      "border-up-500", "bg-up-50", "text-up-700",
      "border-down-500", "bg-down-50", "text-down-700",
    );
  });
  btn.setAttribute("aria-pressed", "true");
  btn.classList.add(
    ...(dir === "up"
      ? ["border-up-500", "bg-up-50", "text-up-700"]
      : ["border-down-500", "bg-down-50", "text-down-700"]),
  );
}

function setCounts(group: HTMLElement, up: number, down: number) {
  const upEl = group.querySelector<HTMLElement>("[data-count='up']");
  const downEl = group.querySelector<HTMLElement>("[data-count='down']");
  const scoreEl = group.querySelector<HTMLElement>("[data-score]");
  const fmt = (n: number) => n.toLocaleString("en-US");
  if (upEl) upEl.textContent = fmt(up);
  if (downEl) downEl.textContent = fmt(down);
  if (scoreEl) scoreEl.textContent = fmt(up - down);
  group.dataset.net = String(up - down);
  reflowRanking();
}

function reflowRanking() {
  const list = document.querySelector<HTMLElement>("[data-rank-list]");
  if (!list) return;
  const rows = [...list.querySelectorAll<HTMLElement>("li[data-entry]")];
  if (rows.length < 2) return;
  const net = (li: HTMLElement) => Number(li.querySelector<HTMLElement>("[data-entry-id]")?.dataset.net ?? 0);
  const downs = (li: HTMLElement) => Number(li.querySelector<HTMLElement>("[data-entry-id]")?.dataset.down ?? 0);
  const order = rows.slice().sort((a, b) => net(b) - net(a) || downs(a) - downs(b));
  if (order.every((el, i) => el === rows[i])) return;
  order.forEach((el, i) => {
    list.appendChild(el);
    const badge = el.querySelector<HTMLElement>("[data-rank-badge]");
    if (!badge) return;
    badge.textContent = String(i + 1);
    const medal = i < 3;
    badge.setAttribute("aria-label", `Rank ${i + 1}`);
    badge.classList.toggle("bg-gold-100", medal);
    badge.classList.toggle("text-gold-700", medal);
    badge.classList.toggle("ring-2", medal);
    badge.classList.toggle("ring-gold-500/40", medal);
    badge.classList.toggle("bg-ink-100", !medal);
    badge.classList.toggle("text-ink-600", !medal);
  });
}

async function deltaMap(cfg: LiveConfig, onlyEntryId?: string): Promise<Record<string, VoteDelta>> {
  let raw: unknown;
  if (cfg.mode === "supabase") {
    const q = onlyEntryId
      ? `/rest/v1/live_deltas?select=entry_id,up,down&entry_id=eq.${encodeURIComponent(onlyEntryId)}`
      : "/rest/v1/live_deltas?select=entry_id,up,down";
    const rows = (await jsonGet(cfg, q)) as Array<{ entry_id: string; up: number; down: number }>;
    raw = Object.fromEntries(rows.map((r) => [r.entry_id, { up: r.up, down: r.down }]));
  } else {
    raw = await jsonGet(cfg, "/votes");
  }
  return raw as Record<string, VoteDelta>;
}

async function syncEntry(group: HTMLElement, cfg: LiveConfig) {
  const entryId = group.dataset.entryId!;
  try {
    const d = (await deltaMap(cfg, entryId))[entryId] ?? { up: 0, down: 0 };
    setCounts(group, Number(group.dataset.up) + d.up, Number(group.dataset.down) + d.down);
  } catch {

  }
}

async function applyDeltas(cfg: LiveConfig) {
  const deltas = await deltaMap(cfg);
  document.querySelectorAll<HTMLElement>("[data-entry-id]").forEach((group) => {
    const d = deltas[group.dataset.entryId!];
    if (!d) return;
    setCounts(group, Number(group.dataset.up) + d.up, Number(group.dataset.down) + d.down);
  });
  const map = await deltaMap(cfg);
  document.querySelectorAll<HTMLElement>("[data-live-total-votes]").forEach((el) => {
    const sum = Object.values(deltas).reduce((s, d) => s + d.up + d.down, 0);
    const base = Number(el.dataset.liveTotalVotes);
    el.textContent = (base + sum).toLocaleString("en-US");
  });
  return deltas;
}

function paintAllowance(api: LiveConfig | null) {
  const wrap = document.querySelector<HTMLElement>("[data-allowance-dots]");
  if (!wrap) return;
  if (!api) return;
  const used = siteVotesUsed(ledger(), "");
  wrap.querySelectorAll<HTMLElement>("[data-dot]").forEach((dot, i) => {
    dot.classList.toggle("bg-brand-600", i < used);
    dot.classList.toggle("border-brand-600", i < used);
    dot.classList.toggle("bg-white", i >= used);
  });
  wrap.setAttribute("aria-label", `${used} of ${VOTES_PER_SITE} site votes used in 24 hours`);
}

export function initVotes(toast: (msg: string) => void) {
  const groups = document.querySelectorAll<HTMLElement>("[data-entry-id]");
  const api = liveConfig();
  groups.forEach((g) => {
    g.dataset.net = String(Number(g.dataset.up) - Number(g.dataset.down));
  });

  if (!api) {

    groups.forEach((group) => {
      group.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-vote]");
        if (!btn || group.dataset.voted === "1") return;
        group.dataset.voted = "1";
        markVoted(group, btn, btn.dataset.vote as "up" | "down");
        toast("Demo vote, set PUBLIC_LIVE_API to enable real voting.");
      });
    });
    return;
  }

  applyDeltas(api).catch(() => toast("Live counts unavailable, showing yesterday's snapshot."));
  const l0 = ledger();
  groups.forEach((g) => restoredState(g, l0));
  paintAllowance(api);

  groups.forEach((group) => {
    group.addEventListener("click", async (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-vote]");
      if (!btn) return;
      const entryId = group.dataset.entryId!;
      const categoryId = group.dataset.categoryId!;
      const rankingId = group.dataset.rankingId ?? entryId.split(":")[0];
      const dir = btn.dataset.vote as "up" | "down";
      const l = ledger();
      const prev = l[entryId];
      const active = prev && Date.now() - prev.ts < DAY;
      if (active && prev!.dir === dir) {
        toast("You already voted on this item in the last 24 hours.");
        return;
      }
      if (!active && recentVotesIn(l, "rankingId", rankingId, entryId) >= VOTES_PER_RANKING) {
        toast("One vote per ranking every 24 hours; pick your favourite here.");
        return;
      }
      if (!active && siteVotesUsed(l, entryId) >= VOTES_PER_SITE) {
        toast("Site allowance reached: 3 votes per 24 hours. They refresh tomorrow.");
        return;
      }

      if (api!.mode === "supabase" && !(await session())) {
        toast("Sign in with Google to vote, taking you there now.");
        await requireAuth();
        return;
      }
      markVoted(group, btn, dir);
      try {
        const res =
          api!.mode === "supabase"
            ? await fetch(`${api!.url}/rest/v1/rpc/cast_vote`, {
                method: "POST",
                headers: await headersFor(api!, true),
                body: JSON.stringify({ p_entry: entryId, p_category: categoryId, p_dir: dir, p_device: deviceId() }),
              })
            : await fetch(`${api!.url}/votes`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ entryId, categoryId, dir, deviceId: deviceId(), switching: !!active }),
              });
        const body = await res.json();
        if (!res.ok || body.ok !== true) throw new Error(body.error ?? String(res.status));
        await syncEntry(group, api!);
        l[entryId] = { dir, ts: Date.now(), categoryId, rankingId };
        saveLedger(l);
        paintAllowance(api);
        toast(active ? "Vote changed, no extra allowance used." : "Vote counted live. Thank you!");
      } catch (err) {
        if (active) markVoted(group, group.querySelector<HTMLButtonElement>(`[data-vote="${prev!.dir}"]`)!, prev!.dir);
        else btn.setAttribute("aria-pressed", "false");
        toast(`Vote failed (${String(err)}), nothing was recorded.`);
      }
    });
  });
}

export function initComments(toast: (msg: string) => void) {
  const form = document.querySelector<HTMLFormElement>("[data-comment-form]");
  const entryId = document.querySelector<HTMLElement>("[data-discussion-entry]")?.dataset.discussionEntry;
  if (!form || !entryId) return;
  const api = liveConfig();

  const authorInput = form.querySelector<HTMLInputElement>("input[name=author]");
  const bodyInput = form.querySelector<HTMLTextAreaElement>("textarea[name=body]");
  const draftKey = `nr.draft.${entryId}`;
  const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null") as { author?: string; body?: string } | null;
  if (draft?.body && bodyInput && !bodyInput.value) {
    bodyInput.value = draft.body;
    if (authorInput && !authorInput.value) authorInput.value = draft.author ?? "";
  }

  void session().then((s) => {
    if (s && authorInput && !authorInput.value) authorInput.value = displayName(s).slice(0, 40);
  });

  if (api) {
    void mergeLiveComments(api, entryId);
  }

  async function mergeLiveComments(api: LiveConfig, entryId: string) {
    const commentsUrl =
      api.mode === "supabase"
        ? `/rest/v1/comments?select=id,author,body,created_at&status=in.(approved,pending)&entry_id=eq.${encodeURIComponent(entryId)}&order=created_at.desc&limit=50`
        : `/comments?entryId=${encodeURIComponent(entryId)}`;
    fetch(api.url + commentsUrl, { headers: await headersFor(api) })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown) => {
        const comments = (Array.isArray(rows)
          ? rows.map((c: any) => ({ id: c.id, author: c.author, body: c.body, createdAt: c.created_at ?? c.createdAt }))
          : (rows as { comments?: unknown[] }).comments ?? []) as Array<{ id: string; author: string; body: string; createdAt: string }>
        const list = document.getElementById("comment-list");
        if (!list || comments.length === 0) return;
        for (const c of comments) {
          const li = document.createElement("li");
          li.className = "nr-card comment-item p-4";
          li.dataset.score = "0";
          li.dataset.ts = String(+new Date(c.createdAt));
          li.dataset.index = String(-1);
          li.dataset.live = "1";
          const esc = (s: string) =>
            s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
          li.innerHTML =
            `<div class="flex items-center justify-between gap-3"><p class="flex items-center gap-2.5 text-sm font-semibold text-ink-900">` +
            `<span class="grid size-8 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">${esc(c.author.slice(0, 2).toUpperCase())}</span>${esc(c.author)}</p>` +
            `<p class="flex items-center gap-1.5 text-xs text-ink-500"><span class="rounded-full bg-up-100 px-2 py-0.5 font-semibold text-up-700">live</span><time datetime="${esc(c.createdAt)}">just now</time></p></div>` +
            `<p class="mt-2.5 text-sm leading-7 text-ink-700">${esc(c.body)}</p>`;
          list.prepend(li);
        }
        const heading = document.querySelector<HTMLElement>("[data-comment-count]");
        if (heading) heading.textContent = String(list.querySelectorAll(".comment-item").length);
      })
      .catch(() => {});
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!api) {
      toast("Comment posting is live-only, this build has no live API attached.");
      return;
    }
    const data = new FormData(form);
    const author = String(data.get("author") ?? "").trim().slice(0, 40);
    const body = String(data.get("body") ?? "").trim().slice(0, 1000);
    if (!author || body.length < 3) {
      toast("Add a display name and a comment first.");
      return;
    }
    if (api.mode === "supabase" && !(await session())) {
      localStorage.setItem(draftKey, JSON.stringify({ author, body }));
      toast("Sign in with Google to comment, your draft is kept.");
      await requireAuth();
      return;
    }
    try {
      const res =
        api.mode === "supabase"
          ? await fetch(`${api.url}/rest/v1/comments`, {
              method: "POST",
              headers: { ...(await headersFor(api, true)), prefer: "return=minimal" },

              body: JSON.stringify({
                entry_id: entryId,
                author,
                body,
                status: "approved",
                device_id: (await session())?.user.id ?? "web",
              }),
            })
          : await fetch(`${api.url}/comments`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ entryId, author, body, deviceId: deviceId() }),
            });
      if (!res.ok) {
        let msg = String(res.status);
        try {
          const j = await res.json();
          msg = j.error ?? j.message ?? msg;
        } catch {}
        throw new Error(msg);
      }
      form.reset();
      localStorage.removeItem(draftKey);
      toast("Comment posted, live now, part of tomorrow's snapshot.");
      void mergeLiveComments(api, entryId);
    } catch (err) {
      toast(`Comment failed (${String(err)}).`);
    }
  });
}
