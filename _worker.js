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

function jwtEmail(jwt) {
  try {
    const payload = jwt.split(".")[1] || "";
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((payload.length + 3) % 4);
    const claims = JSON.parse(atob(padded));
    return String(claims.email || claims.identity?.email || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function accessEmail(request) {
  const header = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").trim().toLowerCase();
  if (header) return header;
  return jwtEmail(request.headers.get("Cf-Access-Jwt-Assertion") || "");
}

async function sbFetch(env, path, { method = "POST", body, extra = {} } = {}) {
  const base = (env.WEARS_SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE || "";
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
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

async function ensureAuthUser(env, email) {
  const created = await sbFetch(env, "/auth/v1/admin/users", {
    body: { email, email_confirm: true },
  });
  if (created.ok) return created.data;
  const msg = `${created.data?.msg || created.data?.message || created.data?.error_description || ""}`.toLowerCase();
  if (created.status === 422 || msg.includes("already") || msg.includes("registered")) return { email };
  throw new Error(created.data?.msg || created.data?.message || "Auth user failed.");
}

async function generateMagic(env, email) {
  const res = await sbFetch(env, "/auth/v1/admin/generate_link", {
    body: { type: "magiclink", email },
  });
  if (!res.ok) throw new Error(res.data?.msg || res.data?.message || "Session link failed.");
  return res.data;
}

function linkParts(data) {
  const props = data?.properties || data || {};
  const user = data?.user || data || {};
  let hashed = props.hashed_token || data?.hashed_token || "";
  let otp = props.email_otp || data?.email_otp || "";
  const href = props.action_link || data?.action_link || "";
  if (href && !hashed && !otp) {
    try {
      const u = new URL(href);
      hashed = u.searchParams.get("token_hash") || hashed;
      otp = u.searchParams.get("token") || otp;
    } catch {
      /* ignore */
    }
  }
  return {
    userId: user.id || data?.id,
    hashed,
    otp,
    email: user.email || data?.email,
  };
}

async function verifyMagic(env, email, parts) {
  if (parts.hashed) {
    const hashed = await sbFetch(env, "/auth/v1/verify", {
      body: { type: "magiclink", token_hash: parts.hashed, email },
    });
    if (hashed.ok) return hashed.data;
  }
  if (parts.otp) {
    const otp = await sbFetch(env, "/auth/v1/verify", {
      body: { type: "magiclink", token: parts.otp, email },
    });
    if (otp.ok) return otp.data;
  }
  throw new Error("Session verify failed.");
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
  await ensureAuthUser(env, email);
  const link = await generateMagic(env, email);
  const parts = linkParts(link);
  await stampAdmin(env, parts.userId, email);
  const verified = await verifyMagic(env, email, parts);
  const session = verified?.session || verified;
  const access = session?.access_token;
  const refresh = session?.refresh_token;
  if (!access || !refresh) throw new Error("No session tokens.");
  return { access_token: access, refresh_token: refresh, email };
}

async function sessionResponse(request, env) {
  if (request.method !== "GET") return json(405, { error: "GET only." });
  if (!env.WEARS_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) {
    return json(503, { error: "Catalog lock missing. Nazım: wrangler secret put SUPABASE_SERVICE_ROLE" });
  }
  const email = accessEmail(request);
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
    const path = new URL(request.url).pathname;
    if (path === "/api/session") {
      return sessionResponse(request, env);
    }
    if (!env.ASSETS) {
      return locked(403, "Forbidden");
    }
    return withLockHeaders(await env.ASSETS.fetch(request));
  },
};
