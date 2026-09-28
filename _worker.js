const LOCK = {
  "cache-control": "private, no-store, no-cache, must-revalidate",
  "cdn-cache-control": "no-store",
  "cloudflare-cdn-cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
};

function locked(status, body) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...LOCK,
    },
  });
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

export default {
  async fetch(request, env) {
    const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
    if (!jwt) {
      return locked(403, "Forbidden");
    }
    if (!env.ASSETS) {
      return locked(403, "Forbidden");
    }
    return withLockHeaders(await env.ASSETS.fetch(request));
  },
};
