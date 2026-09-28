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

function serviceKey(env) {
  return (
    env.SUPABASE_SERVICE_ROLE ||
    env.SERVICE_ROLE ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SERVICE_ROLE_KEY ||
    env.SECRET_KEY ||
    env.SB_SERVICE_ROLE ||
    ""
  );
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
  const token = key || serviceKey(env);
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
    body: { password, email_confirm: true },
  });
  if (!updated.ok) throw new Error(errText(updated.data) || "Admin password failed.");
  await stampAdmin(env, user.id, email);
  const session = await passwordSession(env, email, password);
  const access = session?.access_token;
  const refresh = session?.refresh_token;
  if (!access || !refresh) throw new Error("No session tokens.");
  return { access_token: access, refresh_token: refresh, email };
}

async function sessionResponse(request, env) {
  if (request.method !== "GET") return json(405, { error: "GET only." });
  if (!sbUrl(env)) {
    return json(503, { error: "WEARS_SUPABASE_URL missing on the Worker." });
  }
  if (!serviceKey(env)) {
    return json(503, {
      error:
        "Worker secret not bound. Cloudflare → Workers → twad → Settings → Variables and Secrets → name SUPABASE_SERVICE_ROLE, encrypt the service_role key, then Redeploy.",
    });
  }
  const key = serviceKey(env);
  if (key.startsWith("sb_publishable_") || key.startsWith("eyJ") && key.length < 80) {
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
    if (!env.ASSETS) {
      return locked(403, "Forbidden");
    }
    return withLockHeaders(await env.ASSETS.fetch(request));
  },
};
