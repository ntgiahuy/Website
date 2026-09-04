/**
 * GiaHuy.Net — thành viên trả phí theo thời gian (dùng chung cho cot / mong / dam).
 *
 * License: GH1.<payload_b64url>.<sig_b64url>
 * payload JSON: { v:1, email, plan, iat, exp, apps:["*"] }
 * Chữ ký: ECDSA P-256 + SHA-256 (Web Crypto), xác minh bằng public JWK trên CDN.
 *
 * Cách dùng trong app:
 *   <script src="https://cdn.giahuy.net/js/membership.js"></script>
 *   const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF" });
 *   if (!ok) return;
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "giahuy.membership.v1";
  var ALL_APPS = ["cot", "mong", "dam"];

  function resolveAsset(pathFromJsDir, absoluteFallback) {
    try {
      if (typeof document !== "undefined" && document.currentScript) {
        var override = document.currentScript.getAttribute("data-jwk");
        if (override && pathFromJsDir.indexOf("public-jwk") !== -1) return override;
        var activateOverride = document.currentScript.getAttribute("data-activate-url");
        if (activateOverride && pathFromJsDir.indexOf("thanh-vien") !== -1 && pathFromJsDir.indexOf("public-jwk") === -1) {
          return activateOverride;
        }
        if (document.currentScript.src) {
          return new URL(pathFromJsDir, document.currentScript.src).href;
        }
      }
    } catch (e) {
      /* fall through */
    }
    return absoluteFallback;
  }

  var DEFAULT_PUBLIC_JWK = resolveAsset(
    "../thanh-vien/public-jwk.json",
    "https://cdn.giahuy.net/thanh-vien/public-jwk.json"
  );
  var ACTIVATE_URL = resolveAsset("../thanh-vien/", "https://cdn.giahuy.net/thanh-vien/");

  var cachedJwk = null;
  var cachedKey = null;

  function b64urlToBytes(s) {
    var pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    var b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToB64url(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function utf8(str) {
    return new TextEncoder().encode(str);
  }

  function parseLicense(raw) {
    var key = String(raw || "").trim().replace(/\s+/g, "");
    var parts = key.split(".");
    if (parts.length !== 3 || parts[0] !== "GH1") {
      throw new Error("Mã thành viên không đúng định dạng (cần bắt đầu bằng GH1.).");
    }
    var payloadBytes = b64urlToBytes(parts[1]);
    var payloadText = new TextDecoder().decode(payloadBytes);
    var payload = JSON.parse(payloadText);
    if (!payload || payload.v !== 1 || !payload.exp) {
      throw new Error("Nội dung mã thành viên không hợp lệ.");
    }
    return {
      raw: key,
      payload: payload,
      payloadB64: parts[1],
      sigBytes: b64urlToBytes(parts[2]),
    };
  }

  async function loadPublicKey(jwkUrl) {
    var url = jwkUrl || DEFAULT_PUBLIC_JWK;
    if (cachedKey && cachedJwk === url) return cachedKey;
    var res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error("Không tải được khóa xác minh thành viên.");
    var jwk = await res.json();
    cachedKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    cachedJwk = url;
    return cachedKey;
  }

  async function verifyLicense(raw, opts) {
    opts = opts || {};
    var parsed = parseLicense(raw);
    var key = await loadPublicKey(opts.jwkUrl);
    var ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      parsed.sigBytes,
      utf8(parsed.payloadB64)
    );
    if (!ok) throw new Error("Chữ ký mã thành viên không hợp lệ.");
    var now = Math.floor(Date.now() / 1000);
    if (parsed.payload.exp < now) {
      var err = new Error("Mã thành viên đã hết hạn.");
      err.code = "EXPIRED";
      err.payload = parsed.payload;
      throw err;
    }
    return parsed.payload;
  }

  function readStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeStored(record) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  }

  function statusFromPayload(payload, license) {
    return {
      active: true,
      email: payload.email || "",
      plan: payload.plan || "",
      apps: payload.apps && payload.apps.length ? payload.apps : ["*"],
      issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      expiresAtMs: payload.exp * 1000,
      daysLeft: Math.max(0, Math.ceil((payload.exp * 1000 - Date.now()) / 86400000)),
      license: license || null,
    };
  }

  function inactiveStatus(reason) {
    return {
      active: false,
      reason: reason || "inactive",
      email: "",
      plan: "",
      apps: [],
      issuedAt: null,
      expiresAt: null,
      expiresAtMs: 0,
      daysLeft: 0,
      license: null,
    };
  }

  async function getStatus(opts) {
    opts = opts || {};
    var stored = readStored();
    if (!stored || !stored.license) return inactiveStatus("missing");
    try {
      var payload = await verifyLicense(stored.license, opts);
      var st = statusFromPayload(payload, stored.license);
      writeStored({ license: stored.license, checkedAt: Date.now(), status: st });
      return st;
    } catch (e) {
      if (e && e.code === "EXPIRED") {
        return inactiveStatus("expired");
      }
      return inactiveStatus("invalid");
    }
  }

  async function activate(licenseKey, opts) {
    opts = opts || {};
    var payload = await verifyLicense(licenseKey, opts);
    var st = statusFromPayload(payload, String(licenseKey).trim().replace(/\s+/g, ""));
    writeStored({ license: st.license, checkedAt: Date.now(), status: st });
    return st;
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function coversApp(status, appId) {
    if (!status || !status.active) return false;
    var apps = status.apps || [];
    if (apps.indexOf("*") !== -1) return true;
    if (!appId) return true;
    return apps.indexOf(appId) !== -1;
  }

  function defaultLockMessage(feature) {
    var f = feature || "tính năng này";
    return (
      "Cần thành viên GiaHuy đang còn hạn để dùng " +
      f +
      ".\n\nMở trang kích hoạt / gia hạn?"
    );
  }

  async function requireActive(opts) {
    opts = opts || {};
    var st = await getStatus(opts);
    if (st.active && coversApp(st, opts.app)) return st;
    if (typeof opts.onLocked === "function") {
      opts.onLocked(st);
      return null;
    }
    var go = global.confirm(defaultLockMessage(opts.feature));
    if (go) {
      var url = opts.activateUrl || ACTIVATE_URL;
      global.open(url, "_blank", "noopener,noreferrer");
    }
    return null;
  }

  /** Bọc hàm xuất PDF / CAD: chỉ chạy khi còn hạn thành viên. */
  function gate(fn, opts) {
    opts = opts || {};
    return async function gated() {
      var args = arguments;
      var self = this;
      var st = await requireActive(opts);
      if (!st) return;
      return fn.apply(self, args);
    };
  }

  function formatExpiry(status) {
    if (!status || !status.active) return "Chưa kích hoạt";
    try {
      return (
        new Date(status.expiresAtMs).toLocaleDateString("vi-VN") +
        " (còn " +
        status.daysLeft +
        " ngày)"
      );
    } catch (e) {
      return status.expiresAt;
    }
  }

  global.GiaHuyMembership = {
    STORAGE_KEY: STORAGE_KEY,
    ALL_APPS: ALL_APPS,
    ACTIVATE_URL: ACTIVATE_URL,
    activate: activate,
    clear: clear,
    getStatus: getStatus,
    requireActive: requireActive,
    gate: gate,
    coversApp: coversApp,
    formatExpiry: formatExpiry,
    verifyLicense: verifyLicense,
    bytesToB64url: bytesToB64url,
    b64urlToBytes: b64urlToBytes,
  };
})(typeof window !== "undefined" ? window : globalThis);
