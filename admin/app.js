const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const PREVIEW_BASE = "http://localhost:4321";
const state = {
  file: null,
  articles: [],
  images: [],
  filter: "all",
  dirty: false,
};

const statusEl = $("#status");
function status(msg, kind = "") {
  statusEl.textContent = msg;
  statusEl.className = `status ${kind}`;
  if (kind === "ok") setTimeout(() => (statusEl.textContent = ""), 2500);
}

async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function dateOnly(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return "";
  return d.toISOString().slice(0, 10);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const escapeAttr = escapeHtml;

function markDirty() {
  state.dirty = true;
}

// ---- git status / publish ---------------------------------------------
async function refreshGit() {
  try {
    const g = await api("/api/status");
    const dot = $("#git-dot");
    if (!g.ok) {
      dot.className = "git-dot bad";
      $("#git-text").textContent = `Git: ${g.error}`;
      return;
    }
    const changes = g.dirty.length;
    dot.className = `git-dot ${changes ? "warn" : "good"}`;
    const parts = [`On ${g.branch}`];
    parts.push(changes ? `${changes} unpublished file${changes === 1 ? "" : "s"}` : "Everything published");
    if (g.ahead) parts.push(`${g.ahead} commit${g.ahead === 1 ? "" : "s"} not pushed`);
    $("#git-text").textContent = parts.join(" · ");
    $("#publish-btn").disabled = changes === 0;
  } catch (err) {
    $("#git-dot").className = "git-dot bad";
    $("#git-text").textContent = `Git: ${err.message}`;
  }
}

async function publish() {
  const message = prompt("Commit message", "content: publish article");
  if (message === null) return;
  status("Publishing…");
  try {
    const r = await api("/api/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    status(`Published ✓ ${r.commit}`, "ok");
    await refreshGit();
    await refreshList();
  } catch (err) {
    status(`Publish error: ${err.message}`, "err");
  }
}

// ---- list --------------------------------------------------------------
async function refreshList() {
  const { articles } = await api("/api/articles");
  state.articles = articles;
  renderList();
}

function renderList() {
  const q = $("#search").value.trim().toLowerCase();
  const list = $("#list");
  list.innerHTML = "";
  const filtered = state.articles.filter((a) => {
    if (state.filter === "draft" && !a.draft) return false;
    if (state.filter === "published" && a.draft) return false;
    if (!q) return true;
    return a.title.toLowerCase().includes(q) || a.slug.includes(q) || a.category.toLowerCase().includes(q);
  });

  if (!filtered.length) {
    const li = document.createElement("li");
    li.className = "list-empty";
    li.textContent = state.articles.length ? "No matching articles." : "No articles yet.";
    list.appendChild(li);
    return;
  }

  filtered.forEach((a) => {
    const li = document.createElement("li");
    if (a.file === state.file) li.classList.add("active");
    const date = (a.updatedAt || a.publishedAt || "").slice(0, 10);
    li.innerHTML = `
      <div class="l-title">${escapeHtml(a.title)}</div>
      <div class="l-meta">
        ${a.category ? `<span class="badge cat">${escapeHtml(a.category)}</span>` : ""}
        ${a.draft ? `<span class="badge draft">Draft</span>` : `<span class="badge live">Live</span>`}
        <span>${escapeHtml(date)}</span>
        <span>${a.wordCount} words</span>
      </div>`;
    li.addEventListener("click", () => loadArticle(a.file));
    list.appendChild(li);
  });
}

// ---- editor ------------------------------------------------------------
async function loadArticle(file) {
  if (state.dirty && !confirm("Discard unsaved changes to the current article?")) return;
  status("Loading…");
  const { data, body } = await api(`/api/article?file=${encodeURIComponent(file)}`);
  state.file = file;
  state.dirty = false;
  renderList();
  $("#empty").classList.add("hidden");
  const form = $("#form");
  form.classList.remove("hidden");

  $("#form-title").textContent = data.title || "Edit article";
  form.title.value = data.title ?? "";
  form.slug.value = data.slug ?? "";
  form.description.value = data.description ?? "";
  form.category.value = data.category ?? "";
  form.author.value = data.author ?? "";
  form.publishedAt.value = dateOnly(data.publishedAt);
  form.updatedAt.value = dateOnly(data.updatedAt ?? data.publishedAt);
  form.draft.checked = !!data.draft;
  form.featured.checked = !!data.featured;
  form.coverImage.value = data.coverImage ?? "";
  form.coverImageAlt.value = data.coverImageAlt ?? "";
  form.keywords.value = Array.isArray(data.keywords) ? data.keywords.join("\n") : "";
  form.intro.value = data.intro ?? "";
  form.conclusion.value = data.conclusion ?? "";
  $("#body").value = body ?? "";

  renderProducts(Array.isArray(data.products) ? data.products : []);
  renderColumns(Array.isArray(data.comparisonColumns) ? data.comparisonColumns : []);
  updateCoverPreview();
  updateHeadMeta();
  status("");
  window.scrollTo({ top: 0 });
}

function currentSlug() {
  const form = $("#form");
  return slugify(form.slug.value.trim() || form.title.value.trim());
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function updateHeadMeta() {
  const form = $("#form");
  const slug = currentSlug();
  const view = $("#view-link");
  const href = `${PREVIEW_BASE}/articles/${slug}/`;
  view.href = href;
  view.title = `Preview at ${href} (needs npm run dev)`;
  $("#head-meta").innerHTML = state.file
    ? `<code>src/content/articles/${escapeHtml(state.file)}</code>`
    : `<span class="badge draft">Unsaved</span>`;
}

function updateCoverPreview() {
  const path = $("#form").coverImage.value.trim();
  const box = $("#cover-preview");
  if (!path) {
    box.innerHTML = `<span class="hint">No cover image selected.</span>`;
    return;
  }
  box.innerHTML = `<img src="${escapeAttr(path)}" alt="Cover preview" />`;
}

// ---- products ----------------------------------------------------------
function renderProducts(products) {
  const wrap = $("#products");
  wrap.innerHTML = "";
  products.forEach((p) => wrap.appendChild(productBlock(p)));
  if (!products.length) wrap.appendChild(productBlock({}));
}

function productBlock(p) {
  const el = document.createElement("div");
  el.className = "product";
  const specs = p.specs && typeof p.specs === "object" ? p.specs : {};
  el.innerHTML = `
    <div class="product-head">
      <strong>Product</strong>
      <button type="button" class="btn danger small remove-product">Remove</button>
    </div>
    <div class="grid2">
      <label>Name<input class="p-name" value="${escapeAttr(p.name)}" /></label>
      <label>Brand<input class="p-brand" value="${escapeAttr(p.brand)}" /></label>
    </div>
    <div class="grid2">
      <label>Price<input class="p-price" value="${escapeAttr(p.price)}" /></label>
      <label>Image path<input class="p-image" value="${escapeAttr(p.image)}" /></label>
    </div>
    <div class="imgrow">
      <label>Image alt<input class="p-imageAlt" value="${escapeAttr(p.imageAlt)}" /></label>
      <input type="file" accept="image/*" class="upload" data-product-image />
    </div>
    <label>Summary<textarea class="p-summary" rows="2">${escapeHtml(p.summary)}</textarea></label>
    <p class="hint">Specs (key → value). Keys must match your comparison columns.</p>
    <div class="specs"></div>
    <button type="button" class="btn ghost small add-spec">+ Spec</button>
  `;
  const specsWrap = $(".specs", el);
  const addSpecRow = (k = "", v = "") => {
    const row = document.createElement("div");
    row.className = "spec-row";
    row.innerHTML = `<input placeholder="key" class="spec-k" value="${escapeAttr(k)}" />
      <input placeholder="value" class="spec-v" value="${escapeAttr(v)}" />
      <button type="button" class="btn danger small">×</button>`;
    $("button", row).addEventListener("click", () => {
      row.remove();
      markDirty();
    });
    specsWrap.appendChild(row);
  };
  Object.entries(specs).forEach(([k, v]) => addSpecRow(k, v));

  $(".add-spec", el).addEventListener("click", () => addSpecRow());
  $(".remove-product", el).addEventListener("click", () => {
    el.remove();
    markDirty();
  });
  $("[data-product-image]", el).addEventListener("change", async (e) => {
    const path = await uploadFile(e.target.files[0]);
    if (path) {
      $(".p-image", el).value = path;
      markDirty();
    }
    e.target.value = "";
  });
  return el;
}

function readProducts() {
  return $$("#products .product").map((el) => {
    const specs = {};
    $$(".spec-row", el).forEach((row) => {
      const k = $(".spec-k", row).value.trim();
      const v = $(".spec-v", row).value.trim();
      if (k) specs[k] = v;
    });
    const out = {
      name: $(".p-name", el).value.trim(),
      brand: $(".p-brand", el).value.trim() || undefined,
      price: $(".p-price", el).value.trim() || undefined,
      image: $(".p-image", el).value.trim() || undefined,
      imageAlt: $(".p-imageAlt", el).value.trim() || undefined,
      summary: $(".p-summary", el).value.trim() || undefined,
      specs: Object.keys(specs).length ? specs : undefined,
    };
    Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }).filter((p) => p.name);
}

// ---- columns -----------------------------------------------------------
function renderColumns(columns) {
  const wrap = $("#columns");
  wrap.innerHTML = "";
  columns.forEach((c) => wrap.appendChild(columnBlock(c)));
  if (!columns.length) wrap.appendChild(columnBlock({}));
}

function columnBlock(c) {
  const el = document.createElement("div");
  el.className = "column column-row";
  el.innerHTML = `
    <div class="spec-row">
      <input placeholder="key (e.g. Range or price)" class="c-key" value="${escapeAttr(c.key)}" />
      <input placeholder="label (e.g. Real-world range)" class="c-label" value="${escapeAttr(c.label)}" />
      <button type="button" class="btn danger small">×</button>
    </div>`;
  $("button", el).addEventListener("click", () => {
    el.remove();
    markDirty();
  });
  return el;
}

function readColumns() {
  return $$(".column-row").map((el) => ({
    key: $(".c-key", el).value.trim(),
    label: $(".c-label", el).value.trim(),
  })).filter((c) => c.key && c.label);
}

// ---- uploads + library -------------------------------------------------
async function uploadFile(file, folder = "uploads") {
  if (!file) return null;
  status("Uploading image…");
  try {
    const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}&folder=${encodeURIComponent(folder)}`, {
      method: "POST",
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    status("Image uploaded", "ok");
    await refreshLibrary();
    return data.path;
  } catch (err) {
    status(`Upload error: ${err.message}`, "err");
    return null;
  }
}

async function refreshLibrary() {
  const { images } = await api("/api/images");
  state.images = images;
  renderLibrary();
}

function renderLibrary() {
  const grid = $("#library-grid");
  grid.innerHTML = "";
  if (!state.images.length) {
    grid.innerHTML = `<p class="hint">No images yet. Upload one above.</p>`;
    return;
  }
  state.images.forEach((img) => {
    const item = document.createElement("div");
    item.className = "library-item";
    item.title = `Copy ${img}`;
    item.innerHTML = `
      <img src="${escapeAttr(img)}" alt="" loading="lazy" />
      <button type="button" class="library-del" title="Delete image">×</button>`;
    item.addEventListener("click", async (e) => {
      if (e.target.closest(".library-del")) return;
      try {
        await navigator.clipboard.writeText(img);
        status(`Copied ${img}`, "ok");
      } catch {
        prompt("Copy image path", img);
      }
    });
    $(".library-del", item).addEventListener("click", async () => {
      if (!confirm(`Delete ${img}? It may be used by an article.`)) return;
      try {
        await api(`/api/images?path=${encodeURIComponent(img)}`, { method: "DELETE" });
        await refreshLibrary();
        status("Image deleted", "ok");
      } catch (err) {
        status(`Delete error: ${err.message}`, "err");
      }
    });
    grid.appendChild(item);
  });
}

// ---- save / new / delete ----------------------------------------------
async function save(e) {
  e.preventDefault();
  const form = $("#form");
  const data = {
    title: form.title.value.trim(),
    slug: form.slug.value.trim() || undefined,
    description: form.description.value.trim(),
    category: form.category.value.trim() || "Guides",
    author: form.author.value.trim() || "NepalRanks Editorial",
    publishedAt: form.publishedAt.value || new Date().toISOString().slice(0, 10),
    updatedAt: form.updatedAt.value || undefined,
    draft: form.draft.checked,
    featured: form.featured.checked,
    coverImage: form.coverImage.value.trim() || undefined,
    coverImageAlt: form.coverImageAlt.value.trim() || undefined,
    keywords: form.keywords.value.split("\n").map((s) => s.trim()).filter(Boolean),
    intro: form.intro.value.trim() || undefined,
    conclusion: form.conclusion.value.trim() || undefined,
    products: readProducts(),
    comparisonColumns: readColumns(),
  };
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  status("Saving…");
  try {
    const res = await api("/api/article", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: state.file, data, body: $("#body").value }),
    });
    state.file = res.file;
    state.dirty = false;
    status("Saved ✓", "ok");
    await refreshList();
    updateHeadMeta();
    await refreshGit();
  } catch (err) {
    status(`Save error: ${err.message}`, "err");
  }
}

function newArticle() {
  if (state.dirty && !confirm("Discard unsaved changes to the current article?")) return;
  state.file = null;
  state.dirty = false;
  renderList();
  $("#empty").classList.add("hidden");
  const form = $("#form");
  form.classList.remove("hidden");
  form.reset();
  $("#form-title").textContent = "New article";
  const today = new Date().toISOString().slice(0, 10);
  form.publishedAt.value = today;
  form.updatedAt.value = today;
  form.category.value = "Buying Guides";
  form.author.value = "NepalRanks Editorial";
  $("#body").value = "## Overview\n\n";
  renderProducts([]);
  renderColumns([{ key: "price", label: "Price" }]);
  updateCoverPreview();
  updateHeadMeta();
  form.title.focus();
}

async function deleteArticle() {
  if (!state.file) return;
  if (!confirm("Delete this article? This cannot be undone.")) return;
  try {
    await api(`/api/article?file=${encodeURIComponent(state.file)}`, { method: "DELETE" });
    state.file = null;
    state.dirty = false;
    $("#form").classList.add("hidden");
    $("#empty").classList.remove("hidden");
    status("Deleted", "ok");
    await refreshList();
    await refreshGit();
  } catch (err) {
    status(`Delete error: ${err.message}`, "err");
  }
}

// ---- wiring ------------------------------------------------------------
$("#search").addEventListener("input", renderList);
$("#new-btn").addEventListener("click", newArticle);
$("#empty-new").addEventListener("click", newArticle);
$("#publish-btn").addEventListener("click", publish);
$("#form").addEventListener("submit", save);
$("#delete-btn").addEventListener("click", deleteArticle);
$("#form").addEventListener("input", () => {
  markDirty();
  if (event.target.name === "slug" || event.target.name === "title") updateHeadMeta();
  if (event.target.name === "coverImage") updateCoverPreview();
});
$("#add-product").addEventListener("click", () => {
  const wrap = $("#products");
  if (wrap.querySelectorAll(".product").length === 1 && !$(".p-name", wrap).value) wrap.innerHTML = "";
  wrap.appendChild(productBlock({}));
  markDirty();
});
$("#add-column").addEventListener("click", () => {
  const wrap = $("#columns");
  if (wrap.querySelectorAll(".column-row").length === 1 && !$(".c-key", wrap).value) wrap.innerHTML = "";
  wrap.appendChild(columnBlock({}));
  markDirty();
});

$$(".filter").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.filter = btn.dataset.filter;
    $$(".filter").forEach((b) => b.classList.toggle("active", b === btn));
    renderList();
  });
});

// cover upload
$('input.upload[data-target="coverImage"]').addEventListener("change", async (e) => {
  const path = await uploadFile(e.target.files[0], "covers");
  if (path) {
    const form = $("#form");
    form.coverImage.value = path;
    updateCoverPreview();
    markDirty();
  }
  e.target.value = "";
});

// library upload
$("#library-upload").addEventListener("change", async (e) => {
  await uploadFile(e.target.files[0]);
  e.target.value = "";
});

// body image insert
$("#body-image").addEventListener("change", async (e) => {
  const path = await uploadFile(e.target.files[0]);
  if (!path) return;
  const ta = $("#body");
  const alt = path.split("/").pop().replace(/\.\w+$/, "").replace(/-/g, " ");
  const snippet = `\n![${alt}](${path})\n`;
  const start = ta.selectionStart ?? ta.value.length;
  ta.value = ta.value.slice(0, start) + snippet + ta.value.slice(ta.selectionEnd ?? start);
  markDirty();
  e.target.value = "";
});

window.addEventListener("beforeunload", (e) => {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

Promise.all([refreshList(), refreshLibrary(), refreshGit()]).then(() => {
  if (state.articles[0]) loadArticle(state.articles[0].file);
});
