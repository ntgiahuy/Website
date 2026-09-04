/**
 * Cloudflare Worker — xác minh mã thành viên GiaHuy phía server.
 *
 * Deploy:
 *   1. npm i -g wrangler  (hoặc dùng dashboard Cloudflare)
 *   2. wrangler secret put MEMBERSHIP_PRIVATE_JWK   # dán JSON private JWK
 *   3. wrangler deploy
 *
 * Gọi từ app:
 *   POST https://<worker>.workers.dev/verify
 *   body: { "license": "GH1...." }
 *   → { ok: true, plan, exp, email } | { ok: false, error }
 *
 * CORS mở cho cot/mong/dam/xd.giahuy.net.
 */
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      return json({ service: "giahuy-license-verify", ok: true }, cors);
    }

    if (request.method !== "POST" || url.pathname !== "/verify") {
      return json({ ok: false, error: "Not found" }, cors, 404);
    }

    try {
      const body = await request.json();
      const license = String(body.license || "").trim();
      const app = body.app ? String(body.app) : null;
      const payload = await verifyLicense(license, env.MEMBERSHIP_PRIVATE_JWK);
      if (app && !(payload.apps || ["*"]).includes("*") && !(payload.apps || []).includes(app)) {
        return json({ ok: false, error: "Mã không áp dụng cho tiện ích này" }, cors, 403);
      }
      return json(
        {
          ok: true,
          plan: payload.plan || null,
          email: payload.email || null,
          exp: payload.exp,
          iat: payload.iat,
          apps: payload.apps || ["*"],
        },
        cors
      );
    } catch (e) {
      return json({ ok: false, error: e.message || "Verify failed" }, cors, 400);
    }
  },
};

function corsHeaders(origin) {
  const allowed = [
    "https://cot.giahuy.net",
    "https://mong.giahuy.net",
    "https://dam.giahuy.net",
    "https://xd.giahuy.net",
    "https://cdn.giahuy.net",
    "http://127.0.0.1:4177",
    "http://localhost:4177",
    "http://127.0.0.1:43123",
    "http://127.0.0.1:43241",
  ];
  const allow = allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(data, cors, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function b64urlToBytes(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importVerifyKeyFromPrivateJwk(privJson) {
  const priv = typeof privJson === "string" ? JSON.parse(privJson) : privJson;
  // Export-compatible public parts are on the same JWK; import for verify using public fields only.
  const pub = { kty: priv.kty, crv: priv.crv, x: priv.x, y: priv.y, ext: true, key_ops: ["verify"] };
  return crypto.subtle.importKey("jwk", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}

async function verifyLicense(raw, privateJwkSecret) {
  if (!privateJwkSecret) throw new Error("Server chưa cấu hình MEMBERSHIP_PRIVATE_JWK");
  const parts = String(raw || "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== "GH1") throw new Error("Định dạng mã không hợp lệ");
  const payloadBytes = b64urlToBytes(parts[1]);
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  if (!payload || payload.v !== 1 || !payload.exp) throw new Error("Payload không hợp lệ");
  const key = await importVerifyKeyFromPrivateJwk(privateJwkSecret);
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[1])
  );
  if (!ok) throw new Error("Chữ ký không hợp lệ");
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error("Mã đã hết hạn");
  return payload;
}
