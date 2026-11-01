#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { cpSync, rmSync, existsSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONTENT = ROOT + "src/data/content/";
const DIST = ROOT + "dist/";
const WORKTREE = ROOT + ".pages-work/";
const args = new Set(process.argv.slice(2));

if (existsSync(ROOT + ".env")) {
  for (const line of readFileSync(ROOT + ".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}
const SB_URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";
const PUSH_URL = process.env.PAGES_PUSH_URL ?? "";
const MAIN_BRANCH = process.env.DEFAULT_BRANCH ?? "";
const BRANCH = process.env.PAGES_BRANCH ?? "gh-pages";
const REMOTE = process.env.PAGES_REMOTE ?? "origin";

const LIVE_API = (process.env.LIVE_API ?? "").replace(/\/$/, "");
const LIVE_TOKEN = process.env.LIVE_TOKEN ?? "dev-admin-token";

const log = (...m) => console.log("[publish]", ...m);
const scrub = (s) => { const p = process.env.GITHUB_PAT ?? ""; return p ? String(s).split(p).join("***") : String(s); };
const git = (...a) => {
  try {
    return execFileSync("git", a, { cwd: ROOT, stdio: "inherit" });
  } catch (e) {
    e.message = scrub(e.message);
    throw e;
  }
};
const gitOut = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();

let pushUrl = PUSH_URL;
if (!pushUrl && process.env.GITHUB_PAT) {
  let repo = process.env.PAGES_REPO ?? "";
  if (!repo) {
    try {
      const url = gitOut("remote", "get-url", "origin");
      repo = (url.match(/github\.com[:\/]([^/]+\/[^/]+?)(?:\.git)?$/) ?? [])[1] ?? "";
    } catch {}
  }
  repo ||= "tsaroz/tsaroz.github.io";
  pushUrl = `https://x-access-token:${process.env.GITHUB_PAT}@github.com/${repo}.git`;
}
const mainBranch = MAIN_BRANCH || gitOut("rev-parse", "--abbrev-ref", "HEAD");

async function httpJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

const readJson = (p) => readFileSync(p, "utf8");

async function sbGet(path) {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, { headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}
async function sbRpc(fn, params) {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`rpc ${fn} -> ${res.status} ${await res.text().catch(() => "")}`);
  return res.json();
}
const writeStore = (name, obj) => writeFileSync(CONTENT + name, JSON.stringify(obj, null, 2) + "\n");
const readStore = (name) => JSON.parse(readFileSync(CONTENT + name, "utf8"));

async function dbMirror() {
  let folded = null;
  try {
    folded = await sbRpc("fold_into_baseline", {});
  } catch (err) {
    log(`baseline fold unavailable (${String(err).slice(0, 120)}) — using merge path.`);
    return false;
  }
  const [cats, ranks, ents, cites, sets, cmts, activity] = await Promise.all([
    sbGet("/cat_categories?select=*"),
    sbGet("/cat_rankings?select=*"),
    sbGet("/cat_entries?select=*"),
    sbGet("/cat_cities?select=*"),
    sbGet("/cat_settings?key=eq.site&select=value"),
    sbGet("/comments?select=*&status=eq.approved"),
    sbRpc("activity_7d", { p_days: 7 }).catch(() => ({})),
  ]);

  writeStore("categories.json", cats.map((c) => ({
    id: c.id, name: c.name, slug: c.slug, description: c.description, icon: c.icon,
    createdAt: c.created_at, updatedAt: c.updated_at,
  })));
  const byRank = Object.fromEntries(ranks.map((r) => [r.id, r]));
  writeStore("rankings.json", ranks.map((r) => ({
    id: r.id, categoryId: r.category_id, title: r.title, slug: r.slug, description: r.description,
    ...(r.cities?.length ? { cities: r.cities } : {}),
    ...(r.ad ? { ad: r.ad } : {}), createdAt: r.created_at, updatedAt: r.updated_at,
  })));
  writeStore("entries.json", ents.map((e) => {
    const r = byRank[e.ranking_id];
    const a = activity?.[e.id] ?? {};
    return {
      id: e.id, rankingId: e.ranking_id, categoryId: e.category_id, name: e.name, slug: e.slug,
      description: e.description,
      image: e.image_url || `/img/entries/${r?.slug ?? "unknown"}/${e.slug}.svg`,
      imageAlt: e.image_url ? `${e.name} image` : `${e.name} logo tile`,
      upvotes: e.upvotes, downvotes: e.downvotes,
      votes7d: a.votes ?? 0, comments7d: a.comments ?? 0,
      createdAt: e.created_at, updatedAt: e.updated_at,
    };
  }));
  writeStore("cities.json", cites.map((c) => ({ id: `city-${c.slug}`, name: c.name, slug: c.slug, district: c.district ?? undefined, description: c.description })));
  if (sets?.[0]?.value) writeStore("settings.json", sets[0].value);

  const prev = readStore("comments.json");
  const byEntry = (prev.entryComments ??= {});
  const seen = new Set();
  for (const [eid, rows] of Object.entries(byEntry)) for (const r of rows) seen.add(`${eid}|${r.author}|${r.createdAt}`);
  const hiddenIds = new Set((await sbGet("/comments?select=id&status=eq.hidden")).map((h) => h.id));
  let added = 0;
  for (const c of cmts) {
    if (seen.has(`${c.entry_id}|${c.author}|${c.created_at}`)) continue;
    (byEntry[c.entry_id] ??= []).push({ id: c.id, author: c.author, body: c.body, upvotes: c.upvotes ?? 0, downvotes: c.downvotes ?? 0, createdAt: c.created_at });
    added++;
  }
  for (const rows of Object.values(byEntry)) {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].id && hiddenIds.has(rows[i].id)) rows.splice(i, 1);
    rows.sort((x, y) => (y.upvotes - y.downvotes) - (x.upvotes - x.downvotes));
  }
  writeStore("comments.json", { pools: {}, expanded: [], entryComments: byEntry });
  const totalComments = Object.values(byEntry).reduce((t, r) => t + r.length, 0);
  log(`content: ${totalComments} comments (+${added}).`);

  try {
    const up = await fetch(`${SB_URL}/rest/v1/site_entries`, {
      method: "POST",
      headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, "content-type": "application/json", prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(ents.map((e) => ({ entry_id: e.id, category_id: e.category_id }))),
    });
    log(`lookup: synced (${up.status}).`);
  } catch {}
  log(`content: ${cats.length} categories, ${ranks.length} rankings, ${ents.length} entries, ${cites.length} cities.`);
  try {
    const purged = await sbRpc("purge_baked", { p_keep_days: 14 });
    log("storage: pruned.");
  } catch (err) {
    log(`storage: skipped (${String(err).slice(0, 80)}).`);
  }
  return true;
}

async function bake() {
  if (args.has("--no-live")) return;
  if (SB_URL && SB_KEY) {
    try {
      await dbMirror();
      return;
    } catch (err) {
      log(`mirror failed (${String(err).slice(0, 140)}) — using snapshot.`);
    }
  }

  let exported;
  try {
    if (SB_URL && SB_KEY) {
      const before = new Date().toISOString();
      const [rows, activity, comments] = await Promise.all([
        sbGet("/live_deltas?select=entry_id,up,down"),
        sbRpc("activity_7d", { p_days: 7 }),
        sbGet(`/comments?select=id,entry_id,author,body,created_at&status=eq.approved&created_at=lte.${before}&order=created_at.asc`),
      ]);
      exported = { backend: "supabase", before, voteDeltas: Object.fromEntries(rows.map((r) => [r.entry_id, { up: r.up, down: r.down }])), comments: comments.map((c) => ({ id: c.id, entryId: c.entry_id, author: c.author, body: c.body, createdAt: c.created_at })), activity };
    } else if (LIVE_API && !args.has("--no-live")) {
      const tok = encodeURIComponent(LIVE_TOKEN);
      const [exp, act] = await Promise.all([
        httpJson(`${LIVE_API}/admin/export?token=${tok}`),
        httpJson(`${LIVE_API}/admin/activity?days=7&token=${tok}`).catch(() => ({ activity: {} })),
      ]);
      exported = { backend: "live-api", before: new Date().toISOString(), voteDeltas: exp.voteDeltas ?? {}, comments: exp.comments ?? [], activity: act.activity ?? {} };
    } else {
      log("sync: backend not configured.");
      return;
    }
  } catch (err) {
    log(`sync: backend unreachable (${String(err).slice(0, 120)}).`);
    return;
  }
  const activity = exported.activity ?? {};
  const stamp = Date.now();
  const entries = JSON.parse(readJson(CONTENT + "entries.json"));
  const rankings = JSON.parse(readJson(CONTENT + "rankings.json"));
  const comments = JSON.parse(readJson(CONTENT + "comments.json"));
  for (const e of entries) {
    const a = activity[e.id];
    e.votes7d = a?.votes ?? 0;
    e.comments7d = a?.comments ?? 0;
  }
  let votesApplied = 0;
  const touchedRankings = new Set();
  for (const [entryId, d] of Object.entries(exported.voteDeltas ?? {})) {
    const e = entries.find((x) => x.id === entryId);
    if (!e) { log(`fold: unknown item skipped.`); continue; }
    e.upvotes += d.up;
    e.downvotes += d.down;
    e.updatedAt = new Date(stamp).toISOString();
    touchedRankings.add(e.rankingId);
    votesApplied += d.up + d.down;
  }
  for (const r of rankings) if (touchedRankings.has(r.id)) r.updatedAt = new Date(stamp).toISOString();
  let commentsApplied = 0;
  comments.entryComments ??= {};
  for (const c of exported.comments ?? []) {
    const e = entries.find((x) => x.id === c.entryId);
    if (!e) { log("fold: orphan comment skipped."); continue; }
    (comments.entryComments[c.entryId] ??= []).push({ author: c.author, body: c.body, upvotes: 0, downvotes: 0, createdAt: c.createdAt });
    commentsApplied++;
  }
  if (args.has("--dry-run")) {
    log(`sync(dry): ${votesApplied} votes, ${commentsApplied} comments pending.`);
    return;
  }
  let wrote = 0;
  for (const [name, obj] of [["entries.json", entries], ["comments.json", comments], ["rankings.json", rankings]]) {
    const out = JSON.stringify(obj, null, 2) + "\n";
    if (existsSync(CONTENT + name) && readFileSync(CONTENT + name, "utf8") === out) continue;
    writeFileSync(CONTENT + name, out);
    wrote++;
  }
  log(`sync: ${votesApplied} votes, ${commentsApplied} comments folded.`);
  if (exported.backend === "supabase") {
    await sbRpc("mark_bake", { p_before: exported.before });
  } else {
    await httpJson(`${LIVE_API}/admin/baked?token=${encodeURIComponent(LIVE_TOKEN)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ before: stamp, commentIds: (exported.comments ?? []).map((c) => c.id) }),
    });
  }
}

function build() {
  if (args.has("--skip-build")) {
    log("build: skipped (--skip-build).");
  } else {
    log("build: astro build ...");
    execFileSync("npx", ["astro", "build"], { cwd: ROOT, stdio: "inherit" });
  }

  const CF_PROJECT = process.env.CLOUDFLARE_PAGES_PROJECT ?? "";
  if (CF_PROJECT) {
    const pdir = (process.env.PANEL_DIR ?? "cp-7f3k9q").replace(/^\/|\/$/g, "");
    if (!existsSync(DIST + pdir)) {
      log("panel: bundle missing in this build.");
    } else {
      const stage = ROOT + ".panelout/";
      rmSync(stage, { recursive: true, force: true });
      cpSync(DIST + pdir, stage + pdir, { recursive: true });
      cpSync(DIST + "_astro", stage + "_astro", { recursive: true });
      if (existsSync(DIST + "favicon.svg")) cpSync(DIST + "favicon.svg", stage + "favicon.svg");
      writeFileSync(stage + "robots.txt", "User-agent: *\nDisallow: /\n");
      const env = { ...process.env };
      if (!env.CLOUDFLARE_API_TOKEN) delete env.CLOUDFLARE_API_TOKEN;
      try {
        execFileSync("npx", ["-y", "wrangler", "pages", "deploy", ".panelout", "--project-name", CF_PROJECT, "--branch", "main"], { cwd: ROOT, stdio: "inherit", env });
        log("panel: published.");
      } catch (err) {
        log(`panel: deploy failed (${err.message}); continuing.`);
      }
      rmSync(stage, { recursive: true, force: true });
    }
  }
  if ((process.env.PUBLISH_STRIP_PANEL ?? "0") === "1") {
    const panelDir = (process.env.PANEL_DIR ?? "cp-7f3k9q").replace(/^\/|\/$/g, "");
    rmSync(DIST + panelDir, { recursive: true, force: true });
    log("panel: omitted from this build.");
  }

  const astro = DIST + "_astro/";
  if (existsSync(astro)) {
    const html = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = dir + e.name;
        if (e.isDirectory()) walk(full + "/");
        else if (e.name.endsWith(".html")) html.push(readFileSync(full, "utf8"));
      }
    };
    walk(DIST);
    const all = html.join("");
    const refd = new Set([...all.matchAll(/_astro\/([A-Za-z0-9._-]+\.js(?:\.map)?)/g)].map((m) => m[1]));
    for (const m of all.matchAll(/_astro\/([A-Za-z0-9._-]+\.css)/g)) refd.add(m[1]);

    for (const stack = [...refd]; stack.length; ) {
      const f = stack.pop();
      if (!f.endsWith(".js")) continue;
      let src = "";
      try { src = readFileSync(astro + f, "utf8"); } catch { continue; }
      for (const m of src.matchAll(/([A-Za-z0-9._-]+\.js)/g)) {
        if (!refd.has(m[1])) { refd.add(m[1]); stack.push(m[1]); }
      }
    }
    let dropped = 0;
    for (const f of readdirSync(astro)) {
      if (!refd.has(f)) { rmSync(astro + f); dropped++; }
    }
    log(`build: done (${dropped} chunks pruned).`);
  }
}

function cleanDir(dir, keep) {
  for (const f of readdirSync(dir)) {
    if (f === keep) continue;
    rmSync(dir + f, { recursive: true, force: true });
  }
}

function push() {
  const hasHead = (() => {
    try {
      gitOut("rev-parse", "--verify", "HEAD");
      return true;
    } catch {
      return false;
    }
  })();

  if (!hasHead) {
    log("push: no commits yet.");
    return;
  }
  const dirty = gitOut("status", "--porcelain", "--", "src/data/content");
  if (dirty && !args.has("--dry-run")) {
    git("add", "src/data/content");
    git("commit", "-m", `update ${new Date().toISOString().slice(0, 10)}`);
    log("content: committed.");
    try {
      git("push", pushUrl || REMOTE, `HEAD:refs/heads/${mainBranch}`);
      log(`content: pushed to ${mainBranch}.`);
    } catch {
      log("content: committed locally; remote push failed.");
    }
  }

  if (args.has("--dry-run")) {
    log(`push(dry): would publish dist/ to '${BRANCH}'.`);
    return;
  }

  rmSync(WORKTREE, { recursive: true, force: true });

  try {
    gitOut("rev-parse", "--verify", BRANCH);
  } catch {
    try {
      gitOut("rev-parse", "--verify", `refs/remotes/${REMOTE}/${BRANCH}`);
      git("branch", BRANCH, `refs/remotes/${REMOTE}/${BRANCH}`);
      log("push: branch prepared.");
    } catch {}
  }
  let branchExists;
  try {
    gitOut("rev-parse", "--verify", BRANCH);
    branchExists = true;
  } catch {
    branchExists = false;
  }

  if (branchExists) {
    git("worktree", "add", WORKTREE, BRANCH);
    cleanDir(WORKTREE, ".git");
  } else {
    git("worktree", "add", "--detach", WORKTREE, "HEAD");
    git("-C", ".pages-work", "checkout", "--orphan", BRANCH);
    cleanDir(WORKTREE, ".git");
  }
  cpSync(DIST, WORKTREE, { recursive: true });
  writeFileSync(WORKTREE + ".nojekyll", "");

  git("-C", ".pages-work", "add", "-A");
  let changed = true;
  try {
    git("-C", ".pages-work", "diff", "--cached", "--quiet");
    changed = false;
  } catch {
    changed = true;
  }
  if (!changed) {
    git("-C", ".pages-work", "reset", "--hard", "-q");
    git("worktree", "remove", WORKTREE);
    log("push: tree unchanged.");
  } else {
    git("-C", ".pages-work", "commit", "-m", `site build ${new Date().toISOString().slice(0, 10)}`);
    git("worktree", "remove", WORKTREE);
  }

  const remotes = gitOut("remote").split("\n").filter(Boolean);
  if (remotes.includes(REMOTE)) {
    git("push", pushUrl || REMOTE, `${BRANCH}:${BRANCH}`);
    log("push: published.");
  } else if (pushUrl) {
    git("push", pushUrl, `${BRANCH}:${BRANCH}`);
    log("push: published.");
  } else {
    log(`push: '${BRANCH}' updated locally; no remote configured.`);
  }
}

log("run start", new Date().toISOString());
if (pushUrl && !PUSH_URL) log("mode: authenticated push.");
if (!args.has("--skip-build") && !existsSync(ROOT + "node_modules")) {
  console.error("[publish] node_modules missing — run npm install first.");
  process.exit(1);
}
await bake();
build();
push();
log("done.");
