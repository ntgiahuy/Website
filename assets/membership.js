/**
 * GiaHuy.Net — thành viên trả phí theo thời gian (dùng chung cho cot / mong / dam).
 *
 * License: GH1.<payload_b64url>.<sig_b64url>
 * payload JSON: { v:1, email, plan, iat, exp, apps:["*"] }
 * Chữ ký: ECDSA P-256 + SHA-256 (Web Crypto), xác minh bằng public JWK trên CDN.
 *
 * Cách dùng trong app:
 *   <script src="https://ntgiahuy.github.io/home/js/membership.js"></script>
 *   const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF" });
 *   if (!ok) return;
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "giahuy.membership.v1";
  var TRIAL_KEY = "giahuy.trial.v1";
  var TRIAL_MS = 10 * 60 * 1000; // 10 phút, dùng 1 lần / trình duyệt
  var ALL_APPS = ["cot", "mong", "dam"];
  var PLANS = [
    { id: "3m", label: "3 tháng", days: 90 },
    { id: "6m", label: "6 tháng", days: 180 },
    { id: "1y", label: "1 năm", days: 365 },
    { id: "2y", label: "2 năm", days: 730 },
    { id: "3y", label: "3 năm", days: 1095 },
    { id: "lifetime", label: "Vĩnh viễn", days: 36500 },
  ];
  var scriptEl =
    typeof document !== "undefined" && document.currentScript ? document.currentScript : null;
  var VERIFY_URL =
    (scriptEl && scriptEl.getAttribute("data-verify-url")) ||
    ""; // ví dụ Cloudflare Worker /verify — xem workers/license-verify

  function resolveAsset(pathFromJsDir, absoluteFallback) {
    try {
      if (scriptEl) {
        var override = scriptEl.getAttribute("data-jwk");
        if (override && pathFromJsDir.indexOf("public-jwk") !== -1) return override;
        var activateOverride = scriptEl.getAttribute("data-activate-url");
        if (
          activateOverride &&
          pathFromJsDir.indexOf("thanh-vien") !== -1 &&
          pathFromJsDir.indexOf("public-jwk") === -1
        ) {
          return activateOverride;
        }
        if (scriptEl.src) {
          return new URL(pathFromJsDir, scriptEl.src).href;
        }
      }
    } catch (e) {
      /* fall through */
    }
    return absoluteFallback;
  }

  var DEFAULT_PUBLIC_JWK = resolveAsset(
    "../thanh-vien/public-jwk.json",
    "https://ntgiahuy.github.io/home/thanh-vien/public-jwk.json"
  );
  var ACTIVATE_URL = resolveAsset("../thanh-vien/", "https://ntgiahuy.github.io/home/thanh-vien/");

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

  async function verifyLicenseLocal(raw, opts) {
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

  /** Xác minh thêm trên server (Cloudflare Worker). Bắt buộc nếu cấu hình data-verify-url. */
  async function verifyLicenseOnline(raw, opts) {
    opts = opts || {};
    var url = opts.verifyUrl || VERIFY_URL;
    if (!url) return null;
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license: raw, app: opts.app || null }),
    });
    var data = await res.json().catch(function () {
      return null;
    });
    if (!res.ok || !data || !data.ok) {
      var msg = (data && data.error) || "Máy chủ từ chối mã thành viên.";
      var err = new Error(msg);
      if (/hết hạn/i.test(msg)) err.code = "EXPIRED";
      throw err;
    }
    return {
      v: 1,
      email: data.email || undefined,
      plan: data.plan || undefined,
      iat: data.iat,
      exp: data.exp,
      apps: data.apps || ["*"],
    };
  }

  async function verifyLicense(raw, opts) {
    opts = opts || {};
    var localPayload = await verifyLicenseLocal(raw, opts);
    var onlineUrl = opts.verifyUrl || VERIFY_URL;
    if (onlineUrl) {
      // Server là nguồn quyết định khi đã cấu hình Worker
      return await verifyLicenseOnline(raw, opts);
    }
    return localPayload;
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
    if (status.plan === "lifetime" || (status.daysLeft && status.daysLeft > 20000)) {
      return "Vĩnh viễn";
    }
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

  function readTrial() {
    try {
      var raw = localStorage.getItem(TRIAL_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeTrial(record) {
    localStorage.setItem(TRIAL_KEY, JSON.stringify(record));
  }

  /** Trạng thái dùng thử 10 phút / 1 lần trên trình duyệt này. */
  function getTrialStatus() {
    var t = readTrial();
    var now = Date.now();
    if (!t) {
      return {
        started: false,
        active: false,
        usedUp: false,
        remainingMs: TRIAL_MS,
        remainingSec: Math.floor(TRIAL_MS / 1000),
        endsAt: null,
      };
    }
    var endsAt = Number(t.endsAt) || 0;
    var remainingMs = Math.max(0, endsAt - now);
    var active = remainingMs > 0;
    return {
      started: true,
      active: active,
      usedUp: !active,
      remainingMs: remainingMs,
      remainingSec: Math.ceil(remainingMs / 1000),
      endsAt: endsAt,
      startedAt: t.startedAt || null,
    };
  }

  /**
   * Bắt đầu dùng thử. Chỉ được 1 lần / trình duyệt.
   * @returns {{ ok: boolean, status: object, error?: string }}
   */
  function startTrial() {
    var existing = readTrial();
    var now = Date.now();
    if (existing) {
      var st = getTrialStatus();
      if (st.active) return { ok: true, status: st, resumed: true };
      return {
        ok: false,
        status: st,
        error: "Bạn đã dùng hết lượt dùng thử 10 phút trên trình duyệt này. Hãy đăng ký thành viên để tiếp tục.",
      };
    }
    var record = { startedAt: now, endsAt: now + TRIAL_MS, version: 1 };
    writeTrial(record);
    return { ok: true, status: getTrialStatus(), resumed: false };
  }

  function clearTrialForDebug() {
    try {
      localStorage.removeItem(TRIAL_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function formatTrialClock(remainingSec) {
    var s = Math.max(0, Number(remainingSec) || 0);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  /** Thành viên còn hạn HOẶC đang trong 10 phút dùng thử. */
  async function canUseApps(opts) {
    opts = opts || {};
    var member = await getStatus(opts);
    if (member.active) {
      return { allowed: true, mode: "member", member: member, trial: getTrialStatus() };
    }
    var trial = getTrialStatus();
    if (trial.active) {
      return { allowed: true, mode: "trial", member: member, trial: trial };
    }
    return {
      allowed: false,
      mode: trial.usedUp ? "trial_used" : "locked",
      member: member,
      trial: trial,
    };
  }

  global.GiaHuyMembership = {
    STORAGE_KEY: STORAGE_KEY,
    TRIAL_KEY: TRIAL_KEY,
    TRIAL_MS: TRIAL_MS,
    ALL_APPS: ALL_APPS,
    PLANS: PLANS,
    ACTIVATE_URL: ACTIVATE_URL,
    VERIFY_URL: VERIFY_URL,
    activate: activate,
    clear: clear,
    getStatus: getStatus,
    requireActive: requireActive,
    gate: gate,
    coversApp: coversApp,
    formatExpiry: formatExpiry,
    verifyLicense: verifyLicense,
    verifyLicenseLocal: verifyLicenseLocal,
    verifyLicenseOnline: verifyLicenseOnline,
    getTrialStatus: getTrialStatus,
    startTrial: startTrial,
    clearTrialForDebug: clearTrialForDebug,
    formatTrialClock: formatTrialClock,
    canUseApps: canUseApps,
    bytesToB64url: bytesToB64url,
    b64urlToBytes: b64urlToBytes,
  };
})(typeof window !== "undefined" ? window : globalThis);
