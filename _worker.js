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
  return data.msg || data.message || data.error_description || data.error || "";
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
  if (!/^(stars|fits|stories|items|news)\/[A-Za-z0-9._/-]+\.(jpe?g|png|webp)$/i.test(p)) return "";
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
    } else if (filter.outfit_id) {
      clauses.push(`outfit_id=eq.${encodeURIComponent(String(filter.outfit_id))}`);
    } else if (Array.isArray(filter.outfit_ids) && filter.outfit_ids.length) {
      const ids = filter.outfit_ids.slice(0, 100).map((id) => encodeURIComponent(String(id))).join(",");
      clauses.push(`outfit_id=in.(${ids})`);
    } else if (table === "drip_news") {
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

export default {
  async fetch(request, env) {
    const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!jwt) {
      return locked(403, "Forbidden");
    }
    const path = new URL(request.url).pathname.replace(/\/$/, "") || "/";
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
};

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
