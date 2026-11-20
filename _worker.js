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
  return { ok: res.ok, status: res.status, data };
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
  { label: "NBA Store", url: "https://store.nba.com" },
  { label: "Fanatics", url: "https://www.fanatics.com/nba/o-1370+z-938737729-293541727" },
  { label: "Nike SNKRS", url: "https://www.nike.com/launch" },
  { label: "Cactus Jack", url: "https://shop.travisscott.com" },
];

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
    for (const to of toList) {
      r = await cmd(`RCPT TO:<${to}>`);
      if (r.code !== 250 && r.code !== 251) throw new Error(`${to}: ${r.line}`);
    }
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
  const stub = dropStub(env);
  if (!stub) return corsJson(request, 503, { error: "Notify inbox missing." });
  const res = await stub.fetch("https://drop.notify/sub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, newsId, off, at: body.at || env.VICE_AT }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return corsJson(request, res.status, data);
  return corsJson(request, 200, { ok: true, on: !off });
}

async function dropCardProxy(request, env) {
  const key = (await readSecret(env.DROP_STUDIO_KEY)) || (await readSecret(env.GMAIL_APP_PASSWORD));
  if (!key) {
    return json(503, { error: "Set GMAIL_APP_PASSWORD (or DROP_STUDIO_KEY) on Studio so cards can send." });
  }
  const src = new URL(request.url);
  const href = new URL("https://thewearson.com/api/drop-studio");
  const newsId = String(src.searchParams.get("newsId") || "").trim();
  if (newsId) href.searchParams.set("newsId", newsId);
  const init = {
    method: request.method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }
  try {
    const res = await fetch(href.toString(), init);
    const text = await res.text();
    return locked(res.status, text, "application/json; charset=utf-8");
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
  async fetch(request, env) {
    const path = new URL(request.url).pathname.replace(/\/$/, "") || "/";
    if (path === "/api/drop-notify") {
      return dropNotifyResponse(request, env);
    }
    const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!jwt) {
      return locked(403, "Forbidden");
    }
    if (path === "/api/drop-card") {
      return dropCardProxy(request, env);
    }
    if (path === "/api/drop-fire") {
      try {
        const out = await sendDueDropMail(env, { force: true });
        return json(200, out);
      } catch (err) {
        return json(500, { error: String(err && err.message || err) });
      }
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
    ctx.waitUntil(fetch("https://thewearson.com/api/drop-tick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch((err) => console.log("drop-tick", err && err.message)));
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
