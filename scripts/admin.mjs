#!/usr/bin/env node
/**
 * NepalRanks local admin panel.
 *
 * A zero-cloud, portable content editor. Run it on your laptop:
 *
 *   npm run admin
 *
 * It serves a browser UI on http://127.0.0.1:4322 that edits the Markdown
 * articles in src/content/articles and uploads images into public/images.
 * Nothing is sent anywhere. Binds to localhost only.
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ARTICLES_DIR = join(ROOT, "src/content/articles");
const IMAGES_DIR = join(ROOT, "public/images");
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.ADMIN_PORT ?? 4322);
const HOST = "127.0.0.1";

mkdirSync(ARTICLES_DIR, { recursive: true });
mkdirSync(IMAGES_DIR, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function splitFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: {}, body: raw, hasFrontmatter: false };
  let data = {};
  try {
    data = parseYaml(m[1]) ?? {};
  } catch (err) {
    throw new Error(`Invalid frontmatter YAML: ${err.message}`);
  }
  return { data, body: m[2] ?? "", hasFrontmatter: true };
}

function buildFile(data, body) {
  const fm = stringifyYaml(data, { lineWidth: 0 }).trimEnd();
  return `---\n${fm}\n---\n\n${body.replace(/^\n+/, "")}`;
}

function listArticles() {
  if (!existsSync(ARTICLES_DIR)) return [];
  return readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = readFileSync(join(ARTICLES_DIR, f), "utf8");
      let data = {};
      try {
        data = splitFrontmatter(raw).data;
      } catch {
        data = {};
      }
      const slug = data.slug || basename(f, ".md");
      const publishedAt = data.publishedAt ? String(data.publishedAt) : "";
      return {
        file: f,
        slug,
        title: data.title ?? "(untitled)",
        category: data.category ?? "",
        draft: !!data.draft,
        featured: !!data.featured,
        publishedAt,
        updatedAt: data.updatedAt ? String(data.updatedAt) : "",
        coverImage: data.coverImage ?? "",
        productCount: Array.isArray(data.products) ? data.products.length : 0,
        wordCount: countWords(splitFrontmatter(raw).body),
        modifiedAt: statSync(join(ARTICLES_DIR, f)).mtime.toISOString(),
      };
    })
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
}

function countWords(body) {
  const text = String(body ?? "").replace(/[#>*_`\-[\]()!]/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

function safeArticlePath(name) {
  if (!/^[a-z0-9][a-z0-9-]*\.md$/.test(name)) throw new Error("Invalid article filename");
  return join(ARTICLES_DIR, name);
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

function listImages() {
  const out = [];
  const walk = (dir, rel) => {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full, `${rel}/${name}`);
      else if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(name)) out.push(`${rel}/${name}`);
    }
  };
  walk(IMAGES_DIR, "/images");
  return out.sort();
}

function safeImagePath(name) {
  const rel = String(name ?? "").replace(/^\/+/, "");
  if (!/^images\/[a-z0-9/_.-]+$/i.test(rel) || rel.includes("..")) {
    throw new Error("Invalid image path");
  }
  return join(PUBLIC_DIR, rel);
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (err) {
    const detail = (err.stderr || err.stdout || err.message || "").toString().trim();
    throw new Error(detail || "git command failed");
  }
}

function gitStatus() {
  try {
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
    const remote = git(["remote", "get-url", "origin"]);
    const dirty = git(["status", "--porcelain", "--", "src/content", "public/images"]);
    let ahead = 0;
    try {
      ahead = Number(git(["rev-list", "--count", "@{u}..HEAD"]).trim() || 0);
    } catch {
      ahead = 0;
    }
    let lastCommit = "";
    try {
      lastCommit = git(["log", "-1", "--pretty=%h %s", "--", "src/content", "public/images"]);
    } catch {
      lastCommit = "";
    }
    return {
      ok: true,
      branch,
      remote,
      dirty: dirty.split("\n").filter(Boolean),
      ahead,
      lastCommit,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function readBody(req) {
  return new Promise((resolveP, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 25 * 1024 * 1024) reject(new Error("Payload too large"));
      else chunks.push(c);
    });
    req.on("end", () => resolveP(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

// ---- API handlers -------------------------------------------------------

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (pathname === "/api/articles" && req.method === "GET") {
    return json(res, 200, { articles: listArticles() });
  }

  if (pathname === "/api/article" && req.method === "GET") {
    const file = url.searchParams.get("file");
    const p = safeArticlePath(file);
    if (!existsSync(p)) return json(res, 404, { error: "Article not found" });
    const raw = readFileSync(p, "utf8");
    const { data, body } = splitFrontmatter(raw);
    return json(res, 200, { file, data, body });
  }

  if (pathname === "/api/article" && req.method === "POST") {
    const payload = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const origFile = payload.file ? safeArticlePath(payload.file) : null;
    const data = payload.data ?? {};
    if (!data.title) return json(res, 400, { error: "Title is required" });

    const desiredSlug = String(data.slug || slugify(data.title));
    data.slug = desiredSlug;
    const newFile = `${slugify(desiredSlug)}.md`;
    const target = join(ARTICLES_DIR, newFile);

    if (!Array.isArray(data.keywords)) data.keywords = [];
    const raw = buildFile(data, payload.body ?? "");
    writeFileSync(target, raw, "utf8");

    if (origFile && origFile !== target && existsSync(origFile)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(origFile);
    }
    return json(res, 200, { ok: true, file: newFile, slug: desiredSlug });
  }

  if (pathname === "/api/article" && req.method === "DELETE") {
    const file = url.searchParams.get("file");
    const p = safeArticlePath(file);
    if (existsSync(p)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(p);
    }
    return json(res, 200, { ok: true });
  }

  if (pathname === "/api/images" && req.method === "GET") {
    return json(res, 200, { images: listImages() });
  }

  if (pathname === "/api/images" && req.method === "DELETE") {
    const p = safeImagePath(url.searchParams.get("path"));
    if (existsSync(p)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(p);
    }
    return json(res, 200, { ok: true });
  }

  if (pathname === "/api/status" && req.method === "GET") {
    return json(res, 200, gitStatus());
  }

  if (pathname === "/api/publish" && req.method === "POST") {
    const payload = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const message = String(payload.message ?? "").trim() || "content: update articles";
    if (!gitStatus().ok) return json(res, 400, { error: "This folder is not a git repository." });

    git(["add", "--", "src/content", "public/images"]);
    const staged = git(["diff", "--cached", "--name-only", "--", "src/content", "public/images"]);
    if (!staged) return json(res, 400, { error: "Nothing to publish — no article or image changes." });

    git(["commit", "-m", message]);
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
    let pushed = false;
    try {
      git(["push", "origin", branch]);
      pushed = true;
    } catch (err) {
      return json(res, 500, {
        error: `Committed locally but push failed: ${err.message}`,
        committed: true,
        pushed: false,
      });
    }
    return json(res, 200, {
      ok: true,
      committed: true,
      pushed,
      files: staged.split("\n").filter(Boolean),
      commit: git(["log", "-1", "--pretty=%h %s"]),
    });
  }

  if (pathname === "/api/upload" && req.method === "POST") {
    const u = new URL(req.url, `http://${HOST}`);
    const rawName = u.searchParams.get("name") || "upload";
    const folder = (u.searchParams.get("folder") || "uploads")
      .replace(/\.\./g, "")
      .replace(/^\/+|\/+$/g, "")
      .replace(/[^a-z0-9/_-]/gi, "") || "uploads";
    const safeName = `${slugify(basename(rawName, extname(rawName)))}${extname(rawName).toLowerCase()}`;
    const destDir = join(IMAGES_DIR, folder);
    mkdirSync(destDir, { recursive: true });
    const buf = await readBody(req);
    if (!buf.length) return json(res, 400, { error: "Empty upload" });
    writeFileSync(join(destDir, safeName), buf);
    return json(res, 200, { ok: true, path: `/images/${folder}/${safeName}` });
  }

  return json(res, 404, { error: "Unknown API route" });
}

// ---- static admin UI ----------------------------------------------------

function serveAdminUI(res, pathname) {
  const adminDir = join(ROOT, "admin");
  let file = pathname === "/" ? "/index.html" : pathname;
  const full = join(adminDir, file);
  if (!full.startsWith(adminDir) || !existsSync(full)) {
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end("Not found");
  }
  const body = readFileSync(full);
  res.writeHead(200, { "content-type": MIME[extname(full)] ?? "application/octet-stream" });
  res.end(body);
}

function servePublic(res, pathname) {
  const full = join(PUBLIC_DIR, pathname);
  if (!full.startsWith(PUBLIC_DIR) || !existsSync(full) || statSync(full).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end("Not found");
  }
  const body = readFileSync(full);
  res.writeHead(200, { "content-type": MIME[extname(full)] ?? "application/octet-stream" });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    if (url.pathname.startsWith("/images/")) return servePublic(res, url.pathname);
    return serveAdminUI(res, url.pathname);
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  NepalRanks admin → http://${HOST}:${PORT}\n`);
  console.log(`  Articles: ${ARTICLES_DIR}`);
  console.log(`  Images:   ${IMAGES_DIR}\n`);
  console.log("  Ctrl+C to stop. Run `npm run dev` in another terminal for live preview.\n");
});

if (process.argv.includes("--open")) {
  const url = `http://${HOST}:${PORT}`;
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    execFileSync(cmd, args, { stdio: "ignore" });
  } catch {
    /* opening is best-effort */
  }
}
