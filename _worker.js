const LOCK = {
  "cache-control": "private, no-store, no-cache, must-revalidate",
  "cdn-cache-control": "no-store",
  "cloudflare-cdn-cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
};

function locked(status, body, type = "text/plain; charset=utf-8") {
  return new Response(body, {
    status,
    headers: {
      "content-type": type,
      ...LOCK,
    },
  });
}

function json(status, obj) {
  return locked(status, JSON.stringify(obj), "application/json; charset=utf-8");
}

function withLockHeaders(res) {
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(LOCK)) {
    headers.set(key, value);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function b64urlJson(part) {
  const pad = "=".repeat((4 - (part.length % 4)) % 4);
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return JSON.parse(atob(b64));
}

function jwtEmail(jwt) {
  try {
    const claims = b64urlJson(jwt.split(".")[1] || "");
    return String(claims.email || claims.identity?.email || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function accessEmail(request, env) {
  const header = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  if (header) return header;
  const fromJwt = jwtEmail(request.headers.get("Cf-Access-Jwt-Assertion") || "");
  if (fromJwt) return fromJwt;
  return String(env.STUDIO_EMAIL || "thewears.on@gmail.com").trim().toLowerCase();
}

const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE",
  "SERVICE_ROLE",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "SECRET_KEY",
  "SB_SERVICE_ROLE",
  "SB_SECRET_KEY",
];

async function readSecret(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && typeof value.get === "function") {
    try {
      const got = await value.get();
      return typeof got === "string" ? got.trim() : "";
    } catch {
      return "";
    }
  }
  return "";
}

function fireKey(env) {
  return String(env && env.DROP_FIRE_KEY || "wears-on-drop-fire-2026").trim();
}

function sameSecret(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (!x || !y || x.length !== y.length) return false;
  let out = 0;
  for (let i = 0; i < x.length; i += 1) out |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return out === 0;
}

async function fireAuthorized(request, env) {
  const got = String(request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!got) return false;
  const keys = [
    await readSecret(env.DROP_STUDIO_KEY),
    await readSecret(env.GMAIL_APP_PASSWORD),
    fireKey(env),
  ].filter(Boolean);
  return keys.some((k) => sameSecret(got, k));
}

function processEnv(name) {
  try {
    const v = process?.env?.[name];
    return typeof v === "string" ? v.trim() : "";
  } catch {
    return "";
  }
}

function vaultStub(env) {
  if (!env.VAULT) return null;
  return env.VAULT.get(env.VAULT.idFromName("service_role"));
}

async function vaultKey(env) {
  const stub = vaultStub(env);
  if (!stub) return "";
  const res = await stub.fetch("https://twad.vault/key");
  if (!res.ok) return "";
  const data = await res.json().catch(() => ({}));
  return String(data.key || "").trim();
}

async function serviceKey(env) {
  for (const name of SERVICE_KEY_NAMES) {
    const fromEnv = await readSecret(env?.[name]);
    if (fromEnv && !fromEnv.startsWith("sb_publishable_")) return fromEnv;
    const fromProc = processEnv(name);
    if (fromProc && !fromProc.startsWith("sb_publishable_")) return fromProc;
  }
  return vaultKey(env);
}

function keyError(key) {
  if (!key) return "Empty key.";
  if (key.startsWith("sb_publishable_")) return "Wrong key. Use service_role, not the publishable key.";
  if (key.startsWith("eyJ") && key.length < 80) return "Wrong key. Use service_role / sb_secret_.";
  if (!(key.startsWith("sb_secret_") || key.startsWith("eyJ"))) {
    return "Wrong key. Use service_role / sb_secret_.";
  }
  return "";
}

function sbUrl(env) {
  return String(env.WEARS_SUPABASE_URL || "").replace(/\/$/, "");
}

function anonKey(env) {
  return env.WEARS_SUPABASE_ANON_KEY || "";
}

function errText(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  const main = data.msg || data.message || data.error_description || (typeof data.error === "string" ? data.error : "") || "";
  const extra = [data.details, data.hint].filter((v) => typeof v === "string" && v.trim()).join(" ");
  return extra ? `${main} ${extra}`.trim() : String(main || "");
}

async function sbFetch(env, path, { method = "POST", body, extra = {}, key } = {}) {
  const token = key || (await serviceKey(env));
  const res = await fetch(`${sbUrl(env)}${path}`, {
    method,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...extra,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  return { ok: res.ok, status: res.status, data, headers: res.headers };
}

async function findAuthUser(env, email) {
  const listed = await sbFetch(env, "/auth/v1/admin/users?page=1&per_page=200", { method: "GET" });
  const users = listed.data?.users || [];
  return users.find((u) => String(u.email || "").toLowerCase() === email) || null;
}

async function ensureAuthUser(env, email) {
  const existing = await findAuthUser(env, email);
  if (existing?.id) return existing;
  const created = await sbFetch(env, "/auth/v1/admin/users", {
    body: { email, email_confirm: true },
  });
  if (created.ok && created.data?.id) return created.data;
  const again = await findAuthUser(env, email);
  if (again?.id) return again;
  throw new Error(errText(created.data) || "Auth user failed.");
}

async function passwordSession(env, email, password) {
  const key = anonKey(env) || serviceKey(env);
  const res = await sbFetch(env, "/auth/v1/token?grant_type=password", {
    key,
    body: { email, password },
  });
  if (!res.ok) throw new Error(errText(res.data) || "Password grant failed.");
  return res.data;
}

async function stampAdmin(env, userId, email) {
  if (!userId) return;
  const existing = await sbFetch(env, `/rest/v1/users?id=eq.${userId}&select=id,role`, { method: "GET" });
  const row = Array.isArray(existing.data) ? existing.data[0] : null;
  if (row?.role === "admin") return;
  if (row) {
    await sbFetch(env, `/rest/v1/users?id=eq.${userId}`, {
      method: "PATCH",
      extra: { Prefer: "return=minimal" },
      body: { role: "admin" },
    });
    return;
  }
  const nick = (email.split("@")[0] || "studio").replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase() || "STUDIO";
  const attempts = [
    { id: userId, role: "admin", username: nick },
    { id: userId, role: "admin" },
  ];
  for (const body of attempts) {
    const res = await sbFetch(env, "/rest/v1/users", {
      extra: { Prefer: "return=minimal" },
      body,
    });
    if (res.ok || res.status === 409) return;
  }
}

async function mintSession(env, email) {
  const user = await ensureAuthUser(env, email);
  const password = `Tw${crypto.randomUUID()}A1!`;
  const updated = await sbFetch(env, `/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    body: {
      password,
      email_confirm: true,
      app_metadata: { ...(user.app_metadata || {}), role: "admin" },
    },
  });
  if (!updated.ok) throw new Error(errText(updated.data) || "Admin password failed.");
  await stampAdmin(env, user.id, email);
  const session = await passwordSession(env, email, password);
  const access = session?.access_token;
  const refresh = session?.refresh_token;
  if (!access || !refresh) throw new Error("No session tokens.");
  return { access_token: access, refresh_token: refresh, email };
}

const WRITE_TABLES = new Set(["artists", "outfits", "items", "archives", "drip_news"]);
const PHOTO_BUCKET = "image-artist";

function safeStoragePath(raw) {
  const p = String(raw || "").replace(/^\/+/, "");
  if (p.includes("..") || p.includes("//") || p.includes("\\")) return "";
  if (!/^(stars|fits|stories|items|news|archives)\/[A-Za-z0-9._/-]+\.(jpe?g|png|webp)$/i.test(p)) return "";
  return p;
}

function publicPhotoUrl(env, path) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${sbUrl(env)}/storage/v1/object/public/${PHOTO_BUCKET}/${encoded}`;
}

async function uploadResponse(request, env) {
  if (request.method !== "POST") return json(405, { error: "POST only." });
  const key = await serviceKey(env);
  if (!key) return json(503, { error: "NEED_VAULT", code: "NEED_VAULT" });
  const path = safeStoragePath(new URL(request.url).searchParams.get("path"));
  if (!path) return json(400, { error: "Bad photo path." });
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return json(400, { error: "Empty photo." });
  if (bytes.byteLength > 16 * 1024 * 1024) return json(400, { error: "Photo over 16MB." });
  const href = `${sbUrl(env)}/storage/v1/object/${PHOTO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": request.headers.get("content-type") || "image/jpeg",
    "x-upsert": "true",
  };
  let res = await fetch(href, { method: "POST", headers, body: bytes });
  if (res.status === 409) {
    res = await fetch(href, { method: "PUT", headers, body: bytes });
  }
  if (!res.ok) {
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
    return json(res.status, { error: errText(data) || "Upload failed." });
  }
  return json(200, { publicUrl: publicPhotoUrl(env, path) });
}

async function restResponse(request, env) {
  if (request.method !== "POST") return json(405, { error: "POST only." });
  const key = await serviceKey(env);
  if (!key) return json(503, { error: "NEED_VAULT", code: "NEED_VAULT" });
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Bad JSON." });
  }
  const table = String(body.table || "");
  if (!WRITE_TABLES.has(table)) return json(400, { error: "Table not allowed." });
  const op = String(body.op || "");
  if (op === "list") {
    const filter = body.filter && typeof body.filter === "object" && !Array.isArray(body.filter) ? body.filter : {};
    const clauses = ["select=*", "limit=100"];
    if (filter.artist_id) {
      clauses.push(`artist_id=eq.${encodeURIComponent(String(filter.artist_id))}`);
    } else if (filter.guest_artist_id) {
      clauses.push(`guest_artist_id=eq.${encodeURIComponent(String(filter.guest_artist_id))}`);
    } else if (filter.outfit_id) {
      clauses.push(`outfit_id=eq.${encodeURIComponent(String(filter.outfit_id))}`);
    } else if (Array.isArray(filter.outfit_ids) && filter.outfit_ids.length) {
      const ids = filter.outfit_ids.slice(0, 100).map((id) => encodeURIComponent(String(id))).join(",");
      clauses.push(`outfit_id=in.(${ids})`);
    } else if (filter.archive_id) {
      clauses.push(`archive_id=eq.${encodeURIComponent(String(filter.archive_id))}`);
    } else if (table === "drip_news" || table === "archives") {
      clauses.push("order=created_at.desc");
    } else {
      return json(400, { error: "List needs a filter." });
    }
    const res = await sbFetch(env, `/rest/v1/${table}?${clauses.join("&")}`, { method: "GET" });
    if (!res.ok) return json(res.status, { error: errText(res.data) || "List failed." });
    const rowsOut = Array.isArray(res.data) ? res.data : [];
    return json(200, { rows: rowsOut });
  }
  if (op === "insert") {
    const row = body.row;
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return json(400, { error: "Insert needs a row." });
    }
    const res = await sbFetch(env, `/rest/v1/${table}`, {
      extra: { Prefer: "return=representation" },
      body: row,
    });
    if (!res.ok) return json(res.status, { error: errText(res.data) || "Insert failed." });
    const rowOut = Array.isArray(res.data) ? res.data[0] : res.data;
    return json(200, { row: rowOut });
  }
  if (op === "update") {
    const id = body.id;
    const patch = body.patch;
    if (id == null || id === "" || !patch || typeof patch !== "object") {
      return json(400, { error: "Update needs id and patch." });
    }
    const res = await sbFetch(env, `/rest/v1/${table}?id=eq.${encodeURIComponent(String(id))}`, {
      method: "PATCH",
      extra: { Prefer: "return=minimal" },
      body: patch,
    });
    if (!res.ok) return json(res.status, { error: errText(res.data) || "Update failed." });
    return json(200, { ok: true });
  }
  if (op === "delete") {
    const id = body.id;
    if (id == null || id === "") return json(400, { error: "Delete needs id." });
    const res = await sbFetch(env, `/rest/v1/${table}?id=eq.${encodeURIComponent(String(id))}`, {
      method: "DELETE",
      extra: { Prefer: "return=minimal" },
    });
    if (!res.ok) return json(res.status, { error: errText(res.data) || "Delete failed." });
    return json(200, { ok: true });
  }
  return json(400, { error: "Unknown write." });
}

async function sessionResponse(request, env) {
  if (request.method !== "GET") return json(405, { error: "GET only." });
  if (!sbUrl(env)) {
    return json(503, { error: "WEARS_SUPABASE_URL missing on the Worker." });
  }
  const key = await serviceKey(env);
  if (!key) {
    return json(503, { error: "NEED_VAULT", code: "NEED_VAULT" });
  }
  if (key.startsWith("sb_publishable_") || (key.startsWith("eyJ") && key.length < 80)) {
    return json(503, { error: "Wrong key. Use Supabase service_role / sb_secret_, not the publishable key." });
  }
  const email = accessEmail(request, env);
  if (!email) return json(403, { error: "No Access email." });
  try {
    return json(200, await mintSession(env, email));
  } catch (err) {
    return json(500, { error: err.message || "Session failed." });
  }
}

const VICE_STORES = [
  { id: "nba", label: "NBA Store", url: "https://store.nba.com" },
  { id: "fanatics", label: "Fanatics", url: "https://www.fanatics.com/nba/o-1370+z-938737729-293541727" },
  { id: "nike", label: "Nike SNKRS", url: "https://www.nike.com/launch" },
  { id: "cactus", label: "Cactus Jack", url: "https://shop.travisscott.com" },
];
const AF1_STORES = [
  { id: "snkrs", label: "Nike SNKRS", url: "https://www.nike.com/launch" },
  { id: "cactus", label: "Cactus Jack", url: "https://shop.travisscott.com" },
];
const VANS_NEWS_ID = "7768da16-8167-4ea3-ba32-6dd13f884f47";
const VANS_GOAT = "https://www.goat.com/product/vans-lx-old-skool-36-pack-yacht-club-multi-color-vn000e8vbgk";
const VANS_STORES = [{ id: "goat", label: "GOAT", url: VANS_GOAT }];

function corsHeaders(request) {
  const origin = String(request.headers.get("Origin") || "");
  const allow = /^https:\/\/(www\.)?thewearson\.com$/.test(origin)
    || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)
    ? origin
    : "https://thewearson.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function corsJson(request, status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(request),
    },
  });
}

function dropStub(env) {
  if (!env.DROP_NOTIFY) return null;
  return env.DROP_NOTIFY.get(env.DROP_NOTIFY.idFromName("inbox"));
}

function cleanEmail(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 180) return "";
  return s;
}

function b64utf8(s) {
  const bytes = new TextEncoder().encode(String(s || ""));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

async function smtpSend(env, { recipients, subject, text, html }) {
  const user = String(env.GMAIL_USER || "thewears.on@gmail.com").trim();
  const pass = (await readSecret(env.GMAIL_APP_PASSWORD)).replace(/\s+/g, "");
  if (!pass) throw new Error("GMAIL_APP_PASSWORD missing");
  const toList = [...new Set((recipients || []).map(cleanEmail).filter(Boolean))];
  if (!toList.length) return { ok: true, sent: 0 };
  const { connect } = await import("cloudflare:sockets");
  const socket = connect({ hostname: "smtp.gmail.com", port: 465 }, { secureTransport: "on" });
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = "";
  async function readReply() {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error("SMTP closed");
      buf += dec.decode(value, { stream: true });
      const parts = buf.split(/\r?\n/);
      buf = parts.pop() || "";
      for (const line of parts) {
        const m = /^(\d{3})([ -])/.exec(line);
        if (m && m[2] === " ") return { code: Number(m[1]), line };
      }
    }
  }
  async function cmd(line) {
    await writer.write(enc.encode(`${line}\r\n`));
    return readReply();
  }
  try {
    const greet = await readReply();
    if (greet.code !== 220) throw new Error(greet.line);
    let r = await cmd("EHLO thewearson.com");
    if (r.code !== 250) throw new Error(r.line);
    r = await cmd("AUTH LOGIN");
    if (r.code !== 334) throw new Error(r.line);
    r = await cmd(btoa(user));
    if (r.code !== 334) throw new Error(r.line);
    r = await cmd(btoa(pass));
    if (r.code !== 235) throw new Error("Gmail auth failed. Use an App Password.");
    r = await cmd(`MAIL FROM:<${user}>`);
    if (r.code !== 250) throw new Error(r.line);
    r = await cmd(`RCPT TO:<${user}>`);
    if (r.code !== 250) throw new Error(r.line);
    let accepted = 0;
    for (const to of toList) {
      r = await cmd(`RCPT TO:<${to}>`);
      if (r.code === 250 || r.code === 251) accepted += 1;
    }
    if (!accepted) throw new Error("No valid recipients.");
    r = await cmd("DATA");
    if (r.code !== 354) throw new Error(r.line);
    const payload = [
      `From: THE WEARS ON <${user}>`,
      `To: THE WEARS ON <${user}>`,
      `Subject: =?UTF-8?B?${b64utf8(subject)}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      html || text.replace(/\n/g, "<br>"),
      "",
    ].join("\r\n").replace(/^\./gm, "..");
    await writer.write(enc.encode(`${payload}\r\n.\r\n`));
    r = await readReply();
    if (r.code !== 250) throw new Error(r.line);
    await cmd("QUIT");
    return { ok: true, sent: toList.length };
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
    try { await writer.close(); } catch { /* ignore */ }
    try { socket.close(); } catch { /* ignore */ }
  }
}

function dropMailHtml(env) {
  const at = env.VICE_AT || "2026-11-20T15:00:00Z";
  const page = "https://thewearson.com/#/n/" + (env.VICE_NEWS_ID || "");
  const stores = VICE_STORES.map((s) => `<p style="margin:0 0 10px"><a href="${s.url}" style="color:#111;font-weight:900;letter-spacing:1px;text-decoration:none;border-bottom:1.5px solid #111">${s.label}</a></p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#fff;color:#111;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;border:2px solid #111">
    <p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:2px">THE WEARS ON</p>
    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.1;text-transform:uppercase">Drop is live. Shop now.</h1>
    <p style="margin:0 0 20px;font-size:13px;font-weight:700;letter-spacing:1px">20 NOV 2026 · 10:00 AM ET · 18:00 TSİ</p>
    ${stores}
    <p style="margin:24px 0 0"><a href="${page}" style="display:inline-block;padding:14px 18px;background:#111;color:#fff;font-weight:900;letter-spacing:1.4px;text-decoration:none">OPEN THE DROP</a></p>
  </div>
  </body></html>`;
}

async function dropNotifyResponse(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return corsJson(request, 405, { error: "POST only." });
  let body = {};
  try { body = await request.json(); } catch { return corsJson(request, 400, { error: "Bad JSON." }); }
  const email = cleanEmail(body.email);
  const newsId = String(body.newsId || env.VICE_NEWS_ID || "").trim();
  const off = body.off === true;
  if (!email) return corsJson(request, 400, { error: "Email required." });
  if (!newsId) return corsJson(request, 400, { error: "Drop required." });
  const pack = dropPackId(newsId, env);
  if (!off) {
    const live = await loadDropCard(env, newsId, []);
    const at = Date.parse(live.at);
    if (Number.isFinite(at) && Date.now() >= at) {
      return corsJson(request, 410, { error: "Notify closed.", closed: true, newsId: pack });
    }
  }
  const res = await sbFetch(env, "/rest/v1/rpc/wears_drop_notify_put", {
    body: { p_pack: pack, p_email: email, p_off: off },
  });
  if (!res.ok) {
    const msg = errText(res.data) || `NOTIFY PUT ${res.status}`;
    const missing = /could not find|does not exist|schema cache/i.test(msg);
    const full = /list full/i.test(msg);
    return corsJson(request, full ? 429 : 503, {
      error: missing ? "NOTIFY TABLE MISSING. PASTE sql/wears_drop_notify_emails.sql" : full ? "List full." : msg,
    });
  }
  const n = Number(res.data && res.data.n) || 0;
  return corsJson(request, 200, { ok: true, on: !off, newsId: pack, n });
}

function dropPackId(raw, env) {
  const id = String(raw || env.VICE_NEWS_ID || "8cbc034c-8bee-4f9f-a7c9-9b32672e1e65").trim().toLowerCase();
  const af1 = new Set([
    String(env.AF1_NEWS_ID || "75460ba6-0d53-402b-ad25-7a5a5a36dc7e").toLowerCase(),
    String(env.AF1_SHAPE_ID || "93e33b2f-e4e0-494d-b43d-34609210ab13").toLowerCase(),
  ]);
  return af1.has(id) ? String(env.AF1_NEWS_ID || "75460ba6-0d53-402b-ad25-7a5a5a36dc7e").toLowerCase() : id;
}

function parseCount(headers, fallback) {
  const raw = headers && typeof headers.get === "function" ? (headers.get("content-range") || "") : "";
  const total = Number(String(raw.split("/")[1] || "").replace(/[^\d]/g, ""));
  return Number.isFinite(total) && total >= 0 ? total : fallback;
}

async function pageDropEmails(env, newsId, offset = 0, limit = 100, q = "", after = "") {
  const pack = dropPackId(newsId, env);
  const size = Math.min(1000, Math.max(1, Number(limit) || 100));
  const keyset = String(after || "").trim().toLowerCase();
  const from = keyset ? 0 : Math.max(0, Number(offset) || 0);
  const to = from + size - 1;
  let path = `/rest/v1/drop_notify_emails?pack_id=eq.${encodeURIComponent(pack)}&select=email&order=email.asc`;
  const needle = String(q || "").trim().toLowerCase().replace(/[*,]/g, "");
  if (needle) path += `&email=ilike.${encodeURIComponent(`*${needle}*`)}`;
  else if (keyset) path += `&email=gt.${encodeURIComponent(keyset)}`;
  const res = await sbFetch(env, path, {
    method: "GET",
    extra: { Range: `${from}-${to}`, Prefer: "count=exact" },
  });
  if (!res.ok) {
    const msg = errText(res.data) || `NOTIFY READ ${res.status}`;
    const missing = /does not exist|schema cache|could not find/i.test(msg);
    return { emails: [], n: 0, offset: from, error: missing ? "NOTIFY TABLE MISSING. PASTE sql/wears_drop_notify_emails.sql" : msg };
  }
  const emails = [...new Set((Array.isArray(res.data) ? res.data : []).map((row) => String(row?.email || "").trim().toLowerCase()).filter(Boolean))];
  return { emails, n: parseCount(res.headers, from + emails.length), offset: from };
}

async function getDropState(env, newsId) {
  const pack = dropPackId(newsId, env);
  const res = await sbFetch(env, `/rest/v1/drop_notify_state?pack_id=eq.${encodeURIComponent(pack)}&select=sent_store_ids,lock_done,wave`, { method: "GET" });
  const row = Array.isArray(res.data) ? res.data[0] : null;
  const sent = Array.isArray(row?.sent_store_ids) ? row.sent_store_ids.map(String) : [];
  return { sentStoreIds: [...new Set(sent)], lockDone: !!row?.lock_done, wave: row?.wave && typeof row.wave === "object" ? row.wave : null };
}

async function setDropWave(env, newsId, wave) {
  const pack = dropPackId(newsId, env);
  const cur = await getDropState(env, newsId);
  await sbFetch(env, "/rest/v1/drop_notify_state?on_conflict=pack_id", {
    extra: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: {
      pack_id: pack,
      sent_store_ids: cur.sentStoreIds,
      lock_done: cur.lockDone,
      wave,
      updated_at: new Date().toISOString(),
    },
  });
}

async function countDropArmed(env, newsId) {
  const pack = dropPackId(newsId, env);
  const res = await sbFetch(env, "/rest/v1/rpc/wears_drop_notify_put", {
    body: { p_pack: pack, p_email: "tw-count-probe@thewearson.com", p_off: true },
  });
  if (!res.ok) return 0;
  return Number(res.data && res.data.n) || 0;
}

function parseDropJson(raw) {
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
}

function dropStoreId(label, url, fallback) {
  const s = `${label} ${url}`.toLowerCase();
  if (fallback === "snkrs" && /snkrs|nike/.test(s) && !/cactus|travis/.test(s)) return "snkrs";
  if (/goat/.test(s)) return "goat";
  if (/nike|snkrs/.test(s)) return "nike";
  if (/fanatics/.test(s)) return "fanatics";
  if (/nba/.test(s)) return "nba";
  if (/cactus|travis/.test(s)) return "cactus";
  return fallback || String(label || "store").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18) || "store";
}

function listedStores(list) {
  const out = [];
  const seen = new Set();
  for (const s of list || []) {
    const url = hrefAbs(s?.url || s?.href || "");
    const label = String(s?.label || s?.name || s?.store || "").trim();
    if (!url || !label) continue;
    const id = dropStoreId(label, url, s?.id || `s${out.length + 1}`);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label, url });
  }
  return out;
}

function formatDropWhen(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  try {
    const d = new Date(ms).toLocaleString("en-US", {
      timeZone: "America/New_York",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).toUpperCase();
    return `${d} ET`;
  } catch {
    return "";
  }
}

function jobFromNews(row) {
  const json = parseDropJson(row?.drop_json);
  const packed = parseDropNote(row?.buy_note);
  if (json?.on === false || packed.off) return null;
  const stores = listedStores(json?.stores?.length ? json.stores : packed.stores);
  const at = String(json?.at || packed.at || "").trim();
  if (!stores.length || !at) return null;
  return {
    newsId: String(row.id || "").toLowerCase(),
    at,
    storeIds: stores.map((s) => s.id),
  };
}

async function armVansTestIfNeeded(env) {
  const res = await sbFetch(env, `/rest/v1/drip_news?id=eq.${VANS_NEWS_ID}&select=id,drop_json,buy_note`, { method: "GET" });
  const row = Array.isArray(res.data) ? res.data[0] : null;
  if (!row) return { skipped: true };
  const json = parseDropJson(row.drop_json);
  if (json && (json.on === false || json.at)) return { skipped: true };
  const at = new Date(Date.now() + 120000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const drop = { on: true, at, stores: VANS_STORES, defaultId: "goat", test: true };
  const patched = await sbFetch(env, `/rest/v1/drip_news?id=eq.${VANS_NEWS_ID}`, {
    method: "PATCH",
    extra: { Prefer: "return=minimal" },
    body: {
      drop_json: drop,
      buy_url: VANS_GOAT,
      buy_note: `GOAT.COM\nAT ${at}\nGOAT ${VANS_GOAT}`,
    },
  });
  return { ok: patched.ok, at, newsId: VANS_NEWS_ID };
}

async function loadDispatchDropJobs(env) {
  const res = await sbFetch(env, "/rest/v1/drip_news?select=id,drop_json,buy_note&order=created_at.desc&limit=80", { method: "GET" });
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map(jobFromNews).filter(Boolean);
}

function parseDropNote(note) {
  const lines = String(note || "").split(/\r?\n/);
  const stores = [];
  let at = "";
  let off = false;
  for (const line of lines) {
    const t0 = line.trim();
    if (!t0) continue;
    if (/^AT\s+OFF$/i.test(t0) || /^DROP_OFF$/i.test(t0)) { off = true; continue; }
    const atM = t0.match(/^AT\s+(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*$/i);
    if (atM) { at = atM[1].endsWith("Z") ? atM[1] : `${atM[1]}Z`; continue; }
    const sm = t0.match(/^(.+?)\s+(https?:\/\/\S+)\s*$/i);
    if (sm) stores.push({ label: sm[1].trim(), url: sm[2].trim() });
  }
  return { at, stores, off };
}

function hrefAbs(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const url = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
  if (!/^https?:\/\//i.test(url)) return "";
  return url.replace(/"/g, "%22");
}

function escHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function overlayStoreList(base, listed) {
  const byId = {};
  const byUrl = {};
  for (const s of listed || []) {
    const url = hrefAbs(s.url);
    const label = String(s.label || "").trim();
    if (!url || !label) continue;
    const id = String(s.id || "").toLowerCase();
    if (id) byId[id] = { id, label, url };
    byUrl[url.replace(/\/+$/, "")] = { id, label, url };
  }
  return (base || []).map((b) => {
    const u = hrefAbs(b.url).replace(/\/+$/, "");
    const hit = byId[b.id] || (b.id === "snkrs" ? byId.nike : null) || byUrl[u] || {};
    return { id: b.id, label: hit.label || b.label, url: hit.url || b.url };
  });
}

async function loadDropCard(env, newsId, storeIds) {
  const pack = dropPackId(newsId, env);
  const af1 = pack === String(env.AF1_NEWS_ID || "75460ba6-0d53-402b-ad25-7a5a5a36dc7e").toLowerCase();
  const vice = pack === String(env.VICE_NEWS_ID || "8cbc034c-8bee-4f9f-a7c9-9b32672e1e65").toLowerCase();
  const want = new Set((storeIds || []).map((id) => String(id || "").toLowerCase()).filter(Boolean));
  const res = await sbFetch(env, `/rest/v1/drip_news?id=eq.${encodeURIComponent(pack)}&select=id,title,product_name,buy_note,buy_url,drop_json`, { method: "GET" });
  const row = Array.isArray(res.data) ? res.data[0] : null;
  const json = parseDropJson(row?.drop_json);
  const packed = parseDropNote(row?.buy_note);
  const listed = json?.stores?.length ? json.stores : packed.stores;
  let stores;
  if (af1) stores = overlayStoreList(AF1_STORES, listed);
  else if (vice) stores = overlayStoreList(VICE_STORES, listed);
  else stores = listedStores(listed.length ? listed : (pack === VANS_NEWS_ID ? VANS_STORES : []));
  stores = stores.filter((s) => (!want.size || want.has(s.id)) && s.url);
  const at = String(json?.at || packed.at || (af1
    ? (env.AF1_AT || "2026-11-21T15:00:00Z")
    : vice ? (env.VICE_AT || "2026-11-20T15:00:00Z") : "")).trim();
  const title = String(row?.product_name || row?.title || (af1
    ? "GTA 6 × TRAVIS SCOTT - ONLY 600 PAIRS OF THE MULTICOLOR AF1"
    : vice ? "MIAMI HEAT × CACTUS JACK × NIKE × GTA VI" : ""));
  const when = formatDropWhen(at) || (af1 ? "21 NOV 2026 · 10:00 AM ET" : vice ? "20 NOV 2026 · 10:00 AM ET" : "");
  return { newsId: pack, title, when, at, stores, on: json?.on !== false && !packed.off };
}

function dropCardSubject(stores) {
  const one = Array.isArray(stores) && stores.length === 1 ? stores[0].label : "";
  return one ? `DROP LOCK OPENED — ${String(one).toUpperCase()}` : "DROP LOCK OPENED — THE WEARS ON";
}

function dropCardHtml(wave) {
  const newsId = wave.newsId || "8cbc034c-8bee-4f9f-a7c9-9b32672e1e65";
  const slug = String(wave.title || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || newsId;
  const page = `https://thewearson.com/#/n/${slug}`;
  const stores = Array.isArray(wave.stores) ? wave.stores : [];
  const title = escHtml(String(wave.title || "").toUpperCase());
  const when = escHtml(wave.when || "20 NOV 2026 · 10:00 AM ET");
  const face = "'Inter Tight', Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const storeRows = stores.map((s, i) => {
    const on = i === 0;
    const border = i === stores.length - 1 ? "0" : "1.5px solid #000000";
    const bg = on ? "#000000" : "#ffffff";
    const fg = on ? "#ffffff" : "#000000";
    return `<tr>
      <td style="border-bottom:${border};padding:0;background:${bg}">
        <a href="${hrefAbs(s.url)}" style="display:block;padding:20px 16px;font-family:${face};font-size:12px;font-weight:900;letter-spacing:2.4px;line-height:1;text-transform:uppercase;color:${fg};text-decoration:none;text-align:center">${escHtml(s.label)}</a>
      </td>
    </tr>`;
  }).join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f5;color:#000000">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5"><tr><td align="center" style="padding:36px 12px 48px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background:#000000"><tr><td style="padding:0 0 10px 10px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:2px solid #000000;margin:-10px 10px 10px -10px">
    <tr><td align="center" height="56" style="height:56px;background:#000000;color:#ffffff;padding:18px 16px;font-family:${face};font-size:10px;font-weight:900;letter-spacing:2px">THE DROP CARD</td></tr>
    <tr><td align="center" style="padding:36px 20px 28px">
      <h1 style="margin:0;font-family:${face};font-size:48px;line-height:0.92;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:#000000">DROP LOCK<br>OPENED</h1>
      <span style="display:inline-block;margin-top:16px;padding:6px 10px;border:1.5px solid #000000;background:#000000;color:#ffffff;font-family:${face};font-size:8px;font-weight:900;letter-spacing:1.5px">MEMBER</span>
      <p style="margin:18px 0 0;font-family:${face};font-size:11px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:#000000">${title}</p>
      <p style="margin:10px 0 0;font-family:Inter, ${face};font-size:10px;font-weight:900;letter-spacing:1.8px;color:#000000">${when}</p>
    </td></tr>
    <tr><td style="border-top:1.5px solid #000000"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${storeRows}</table></td></tr>
    <tr><td align="center" height="48" style="height:48px;background:#000000;color:#ffffff;padding:16px;font-family:${face};font-size:11px;font-weight:900;letter-spacing:2px"><a href="${page}" style="color:#ffffff;text-decoration:none">THE WEARS ON</a></td></tr>
  </table></td></tr></table></td></tr></table></body></html>`;
}

async function mailDropLocal(env, newsId, storeIds, emails) {
  const live = await loadDropCard(env, newsId, storeIds);
  if (!live.stores.length) throw new Error("No matching live store URLs. Save the dispatch first.");
  const subject = dropCardSubject(live.stores);
  const html = dropCardHtml(live);
  const text = `${live.title}\n${live.when}\n${live.stores.map((s) => `${s.label}: ${s.url}`).join("\n")}`;
  return smtpSend(env, { recipients: emails, subject, text, html });
}

async function mailDropBatch(env, newsId, storeIds, emails, key) {
  const href = new URL("https://thewearson.com/api/drop-studio");
  if (newsId) href.searchParams.set("newsId", newsId);
  const res = await fetch(href.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      newsId,
      storeIds,
      emails,
      batch: true,
      total: emails.length,
      done: false,
    }),
  });
  const text = await res.text();
  let jsonOut = {};
  try { jsonOut = JSON.parse(text); } catch { jsonOut = { error: text || `SEND ${res.status}` }; }
  if (!res.ok) throw new Error(jsonOut.error || `SEND ${res.status}`);
  return jsonOut;
}

async function sendDropBatch(env, newsId, storeIds, emails, key) {
  const gmail = (await readSecret(env.GMAIL_APP_PASSWORD)).replace(/\s+/g, "");
  if (gmail) {
    try {
      return await mailDropLocal(env, newsId, storeIds, emails);
    } catch {
      /* public mailer still has the app password */
    }
  }
  const token = key || (await readSecret(env.DROP_STUDIO_KEY)) || gmail || fireKey(env);
  return mailDropBatch(env, newsId, storeIds, emails, token);
}

async function drainDropStore(env, newsId, storeId, { reset = false, batches = 6, key } = {}) {
  const id = String(storeId || "").toLowerCase();
  const secret = key
    || (await readSecret(env.DROP_STUDIO_KEY))
    || (await readSecret(env.GMAIL_APP_PASSWORD))
    || fireKey(env);
  const state = await getDropState(env, newsId);
  let after = reset || String(state.wave?.storeId || "") !== id ? "" : String(state.wave?.last || "");
  let last = { ok: true, done: false, n: 0, total: 0, remain: 0, storeIds: [id], sent: 0, cursor: after };
  for (let i = 0; i < batches; i += 1) {
    const page = await pageDropEmails(env, newsId, 0, 40, "", after);
    if (page.error) return { error: page.error };
    last.n = page.n;
    last.total = page.n;
    if (!page.n) {
      const armed = await countDropArmed(env, newsId);
      if (armed > 0) {
        return {
          error: "NOTIFY LIST IS IN THE DATABASE BUT STUDIO CANNOT READ IT. PASTE service_role IN STUDIO VAULT.",
          n: armed,
          total: armed,
        };
      }
      await setDropWave(env, newsId, null);
      return { ...last, empty: true, done: true };
    }
    if (!page.emails.length) {
      const sentStoreIds = await markDropSent(env, newsId, [id]);
      await setDropWave(env, newsId, null);
      return { ...last, done: true, remain: 0, sentStoreIds };
    }
    await setDropWave(env, newsId, { storeId: id, last: after });
    try {
      await sendDropBatch(env, newsId, [id], page.emails, secret);
    } catch (err) {
      return { error: String(err && err.message || err), ...last, done: false };
    }
    after = page.emails[page.emails.length - 1];
    last.sent = (last.sent || 0) + page.emails.length;
    last.remain = Math.max(0, page.n - last.sent);
    last.cursor = after;
    await setDropWave(env, newsId, { storeId: id, last: after });
  }
  return last;
}

async function dropJobs(env) {
  const jobs = [
    {
      newsId: env.VICE_NEWS_ID || "8cbc034c-8bee-4f9f-a7c9-9b32672e1e65",
      at: env.VICE_AT || "2026-11-20T15:00:00Z",
      storeIds: ["nba", "fanatics", "nike", "cactus"],
    },
    {
      newsId: env.AF1_NEWS_ID || "75460ba6-0d53-402b-ad25-7a5a5a36dc7e",
      at: env.AF1_AT || "2026-11-21T15:00:00Z",
      storeIds: ["snkrs", "cactus"],
    },
  ];
  const seen = new Set(jobs.map((job) => String(job.newsId).toLowerCase()));
  for (const job of await loadDispatchDropJobs(env)) {
    const id = String(job.newsId || "").toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    jobs.push(job);
  }
  return jobs;
}

async function tickDropFromDb(env) {
  const test = await armVansTestIfNeeded(env).catch((err) => ({ error: String(err && err.message || err) }));
  const jobs = await dropJobs(env);
  const out = [];
  for (const job of jobs) {
    const at = Date.parse(job.at);
    if (!Number.isFinite(at) || Date.now() < at) continue;
    let state = await getDropState(env, job.newsId);
    const waveId = String(state.wave?.storeId || "");
    if (waveId) {
      out.push(await drainDropStore(env, job.newsId, waveId, { batches: 20 }));
      state = await getDropState(env, job.newsId);
    }
    const remain = job.storeIds.filter((id) => !state.sentStoreIds.includes(id));
    for (const storeId of remain) {
      out.push(await drainDropStore(env, job.newsId, storeId, { batches: 20 }));
      state = await getDropState(env, job.newsId);
    }
  }
  return out.length ? { ok: true, waves: out, test } : { skipped: true, test };
}

async function markDropSent(env, newsId, storeIds) {
  const pack = dropPackId(newsId, env);
  const cur = await getDropState(env, newsId);
  const sentStoreIds = [...new Set([...cur.sentStoreIds, ...storeIds.map(String)])];
  await sbFetch(env, "/rest/v1/drop_notify_state?on_conflict=pack_id", {
    extra: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: {
      pack_id: pack,
      sent_store_ids: sentStoreIds,
      lock_done: cur.lockDone,
      wave: null,
      updated_at: new Date().toISOString(),
    },
  });
  return sentStoreIds;
}

async function dropCardProxy(request, env, ctx) {
  const src = new URL(request.url);
  const href = new URL("https://thewearson.com/api/drop-studio");
  const newsId = String(src.searchParams.get("newsId") || "").trim();
  if (newsId) href.searchParams.set("newsId", newsId);
  let payload = "";
  if (request.method !== "GET" && request.method !== "HEAD") {
    payload = await request.text();
  }
  let bodyObj = {};
  if (payload) {
    try { bodyObj = JSON.parse(payload); } catch { bodyObj = {}; }
  }
  const packNewsId = newsId || String(bodyObj.newsId || "");
  const state = await getDropState(env, packNewsId);
  if (request.method === "GET" || request.method === "HEAD") {
    const offset = Math.max(0, Number(src.searchParams.get("offset") || 0) || 0);
    const limit = Math.min(200, Math.max(20, Number(src.searchParams.get("limit") || 100) || 100));
    const page = await pageDropEmails(env, packNewsId, offset, limit, src.searchParams.get("q") || "");
    if (page.error) {
      const armed = await countDropArmed(env, packNewsId).catch(() => 0);
      return json(503, { error: page.error, n: armed, emails: [] });
    }
    let n = page.n;
    let emails = page.emails;
    if (!n) {
      n = await countDropArmed(env, packNewsId);
      if (n > 0) {
        return json(503, {
          error: "NOTIFY LIST IS IN THE DATABASE BUT STUDIO CANNOT READ IT. PASTE service_role IN STUDIO VAULT.",
          n,
          emails: [],
        });
      }
    }
    return json(200, {
      ok: true,
      newsId: dropPackId(packNewsId, env),
      n,
      emails,
      offset: page.offset,
      limit,
      hasMore: page.offset + emails.length < n,
      sentStoreIds: state.sentStoreIds,
      lockDone: state.lockDone,
    });
  }
  const key = (await readSecret(env.DROP_STUDIO_KEY)) || (await readSecret(env.GMAIL_APP_PASSWORD));
  const storeIds = Array.isArray(bodyObj.storeIds) ? bodyObj.storeIds.map(String) : [];
  const storeId = String(storeIds[0] || "").toLowerCase();
  if (!storeId) return json(400, { error: "storeIds required." });
  const waveId = String(state.wave?.storeId || "");
  if (!bodyObj.again && storeIds.every((id) => state.sentStoreIds.includes(id)) && waveId !== storeId) {
    return json(200, { already: true, sentStoreIds: state.sentStoreIds, storeIds });
  }
  try {
    const out = await drainDropStore(env, packNewsId, storeId, {
      reset: bodyObj.again === true,
      batches: 6,
      key,
    });
    if (out.error) return json(503, out);
    if (!out.done && !out.empty && ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(drainDropStore(env, packNewsId, storeId, { batches: 16, key }).catch(() => {}));
    }
    return json(200, { ok: !out.error, ...out, storeIds: [storeId] });
  } catch (err) {
    return json(502, { error: String(err && err.message || err) });
  }
}

async function sendDueDropMail(env, opt = {}) {
  const at = Date.parse(env.VICE_AT || "2026-11-20T15:00:00Z");
  if (!Number.isFinite(at) || (Date.now() < at && !opt.force)) return { skipped: true };
  const stub = dropStub(env);
  if (!stub) return { error: "no inbox" };
  const listed = await stub.fetch("https://drop.notify/list");
  const pack = await listed.json().catch(() => ({}));
  if (pack.sent && !opt.force) return { already: true };
  const emails = Array.isArray(pack.emails) ? pack.emails : [];
  if (!emails.length) return { sent: 0 };
  const subject = "🚨 DROP IS LIVE — THE WEARS ON";
  const text = `DROP IS LIVE.\n\n${VICE_STORES.map((s) => `${s.label}: ${s.url}`).join("\n")}\n\nhttps://thewearson.com/#/n/${env.VICE_NEWS_ID || ""}`;
  const hook = await readSecret(env.DROP_MAIL_HOOK);
  if (hook) {
    const res = await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fire: true, emails, html: dropMailHtml(env), text, subject }),
    });
    if (!res.ok) throw new Error(`mail hook ${res.status}`);
  } else {
    await smtpSend(env, { recipients: emails, subject, text, html: dropMailHtml(env) });
  }
  await stub.fetch("https://drop.notify/sent", { method: "POST" });
  return { sent: emails.length };
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname.replace(/\/$/, "") || "/";
    if (path === "/api/drop-notify") {
      return dropNotifyResponse(request, env);
    }
    if (path === "/api/drop-fire") {
      const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
      if (!(await fireAuthorized(request, env)) && !jwt) {
        return json(401, { error: "Studio auth failed." });
      }
      try {
        const out = await tickDropFromDb(env);
        return json(200, out);
      } catch (err) {
        return json(500, { error: String(err && err.message || err) });
      }
    }
    const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!jwt) {
      return locked(403, "Forbidden");
    }
    if (path === "/api/drop-card") {
      return dropCardProxy(request, env, ctx);
    }
    if (path === "/api/session") {
      return sessionResponse(request, env);
    }
    if (path === "/api/upload") {
      return uploadResponse(request, env);
    }
    if (path === "/api/rest") {
      return restResponse(request, env);
    }
    if (path === "/api/vault") {
      const stub = vaultStub(env);
      if (!stub) return json(503, { error: "Vault binding missing.", code: "NEED_VAULT" });
      if (request.method === "GET") {
        const key = await vaultKey(env);
        return json(200, { ready: Boolean(key) });
      }
      if (request.method !== "PUT") return json(405, { error: "PUT only." });
      return stub.fetch(request);
    }
    if (!env.ASSETS) {
      return locked(403, "Forbidden");
    }
    return withLockHeaders(await env.ASSETS.fetch(request));
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tickDropFromDb(env).catch((err) => console.log("drop-tick", err && err.message)));
  },
};

export class DropNotify {
  constructor(state) {
    this.state = state;
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" || path.endsWith("/list")) {
      const emails = (await this.state.storage.get("emails")) || [];
      const sent = (await this.state.storage.get("sent")) || false;
      return json(200, { emails, sent });
    }
    if (path.endsWith("/sent") && request.method === "POST") {
      await this.state.storage.put("sent", true);
      return json(200, { ok: true });
    }
    let body = {};
    try { body = await request.json(); } catch { body = {}; }
    const email = cleanEmail(body.email);
    const off = body.off === true;
    if (!email) return json(400, { error: "Email required." });
    const cur = new Set((await this.state.storage.get("emails")) || []);
    if (off) cur.delete(email);
    else {
      if (cur.size >= 2000) return json(429, { error: "List full." });
      cur.add(email);
    }
    await this.state.storage.put("emails", [...cur]);
    if (body.at) await this.state.storage.put("at", String(body.at));
    return json(200, { ok: true, n: cur.size });
  }
}

export class StudioVault {
  constructor(state) {
    this.state = state;
  }
  async fetch(request) {
    if (request.method === "GET") {
      const key = (await this.state.storage.get("service_role")) || "";
      return json(200, { key: String(key) });
    }
    if (request.method !== "PUT") return json(405, { error: "PUT only." });
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const key = String(body.key || "").trim();
    const err = keyError(key);
    if (err) return json(400, { error: err });
    await this.state.storage.put("service_role", key);
    return json(200, { ok: true });
  }
}
