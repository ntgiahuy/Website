/**
 * GIAHUY Shop Drawing — thành viên email + OTP (hosting PHP).
 *
 * API gốc: /shop-drawing/api/
 * Dùng:
 *   const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF" });
 *   if (!ok) return;
 */
(function (global) {
  "use strict";

  var BROWSER_KEY = "giahuy.browser.v1";
  var scriptEl =
    typeof document !== "undefined" && document.currentScript ? document.currentScript : null;

  function resolveApiBase() {
    var attr = scriptEl && scriptEl.getAttribute("data-api");
    if (attr) return attr.replace(/\/?$/, "/");
    try {
      if (scriptEl && scriptEl.src) {
        return new URL("../api/", scriptEl.src).href;
      }
    } catch (e) {}
    return "./api/";
  }

  var API_BASE = resolveApiBase();
  var ACTIVATE_URL = (function () {
    var attr = scriptEl && scriptEl.getAttribute("data-activate-url");
    if (attr) return attr;
    try {
      if (scriptEl && scriptEl.src) return new URL("../thanh-vien/", scriptEl.src).href;
    } catch (e) {}
    return "./thanh-vien/";
  })();

  function browserKey() {
    try {
      var k = localStorage.getItem(BROWSER_KEY);
      if (k && /^[a-zA-Z0-9_-]{16,80}$/.test(k)) return k;
      var bytes = new Uint8Array(24);
      (global.crypto || window.crypto).getRandomValues(bytes);
      var s = Array.prototype.map
        .call(bytes, function (b) {
          return ("0" + b.toString(16)).slice(-2);
        })
        .join("");
      localStorage.setItem(BROWSER_KEY, s);
      return s;
    } catch (e) {
      return "fallback-" + String(Date.now());
    }
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign(
      { Accept: "application/json", "X-Browser-Key": browserKey() },
      opts.headers || {}
    );
    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    var res = await fetch(API_BASE + path.replace(/^\//, ""), {
      method: opts.method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: headers,
      body: opts.body,
    });
    var data = await res.json().catch(function () {
      return null;
    });
    if (!res.ok || !data || data.ok === false) {
      var msg =
        (data && data.error) ||
        (res.status === 500
          ? "Lỗi máy chủ (500). Mở /shop-drawing/api/health.php để xem nguyên nhân."
          : "Lỗi máy chủ (" + res.status + ").");
      var err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function statusFromMember(member) {
    if (!member) {
      return {
        active: false,
        reason: "missing",
        email: "",
        plan: "",
        expiresAt: null,
        expiresAtMs: 0,
        daysLeft: 0,
      };
    }
    return {
      active: !!member.active,
      reason: member.active ? "ok" : "expired",
      email: member.email || "",
      plan: member.plan || "",
      expiresAt: member.expires_at_iso || null,
      expiresAtMs: (member.expires_at || 0) * 1000,
      daysLeft: member.days_left || 0,
    };
  }

  async function getMe() {
    return api("auth_me.php");
  }

  async function getStatus() {
    var me = await getMe();
    return statusFromMember(me.member);
  }

  async function requestOtp(email) {
    return api("auth_request.php", { method: "POST", body: { email: email } });
  }

  async function verifyOtp(email, code, token) {
    return api("auth_verify.php", {
      method: "POST",
      body: { email: email, code: code || "", token: token || "" },
    });
  }

  async function logout() {
    return api("auth_logout.php", { method: "POST", body: {} });
  }

  async function startTrial() {
    try {
      var data = await api("trial_start.php", { method: "POST", body: {} });
      return { ok: true, access: data.access, trial: data.trial, resumed: data.resumed };
    } catch (e) {
      return {
        ok: false,
        error: (e && e.message) || "Không bắt đầu được dùng thử.",
        access: e && e.data && e.data.access,
      };
    }
  }

  async function canUseApps() {
    var data = await api("access.php");
    var a = data.access || {};
    return {
      allowed: !!a.allowed,
      mode: a.mode || "locked",
      canPdf: !!a.can_pdf,
      email: a.email || null,
      member: statusFromMember(a.member),
      trial: {
        started: !!(a.trial && a.trial.started),
        active: !!(a.trial && a.trial.active),
        usedUp: !!(a.trial && a.trial.used_up),
        remainingSec: (a.trial && a.trial.remaining_sec) || 0,
        endsAt: (a.trial && a.trial.ends_at) || null,
        trialMinutes: (a.trial && a.trial.trial_minutes) || 30,
      },
      raw: a,
    };
  }

  async function loadPublicConfig() {
    return api("config.php");
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
      return status.expiresAt || "";
    }
  }

  function formatTrialClock(remainingSec) {
    var s = Math.max(0, Number(remainingSec) || 0);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  async function requireActive(opts) {
    opts = opts || {};
    var access = await canUseApps();
    if (access.mode === "member" && access.allowed) return access.member;
    if (access.mode === "trial" && access.allowed && opts.allowTrial) {
      if (opts.feature && /pdf|cad|xuất/i.test(String(opts.feature)) && !access.canPdf) {
        /* fall through to lock */
      } else {
        return access.member;
      }
    }
    if (typeof opts.onLocked === "function") {
      opts.onLocked(access);
      return null;
    }
    var go = global.confirm(
      "Cần đăng nhập email thành viên còn hạn để dùng " +
        (opts.feature || "tính năng này") +
        ".\n\nMở trang thành viên?"
    );
    if (go) global.open(opts.activateUrl || ACTIVATE_URL, "_blank", "noopener,noreferrer");
    return null;
  }

  function gate(fn, opts) {
    opts = opts || {};
    return async function gated() {
      var st = await requireActive(opts);
      if (!st) return;
      return fn.apply(this, arguments);
    };
  }

  global.GiaHuyMembership = {
    API_BASE: API_BASE,
    ACTIVATE_URL: ACTIVATE_URL,
    browserKey: browserKey,
    api: api,
    getMe: getMe,
    getStatus: getStatus,
    requestOtp: requestOtp,
    verifyOtp: verifyOtp,
    logout: logout,
    startTrial: startTrial,
    canUseApps: canUseApps,
    loadPublicConfig: loadPublicConfig,
    formatExpiry: formatExpiry,
    formatTrialClock: formatTrialClock,
    requireActive: requireActive,
    gate: gate,
    PLANS: [
      { id: "3m", label: "3 tháng", days: 90 },
      { id: "6m", label: "6 tháng", days: 180 },
      { id: "1y", label: "1 năm", days: 365 },
      { id: "2y", label: "2 năm", days: 730 },
      { id: "3y", label: "3 năm", days: 1095 },
      { id: "lifetime", label: "Vĩnh viễn", days: 36500 },
    ],
  };
})(typeof window !== "undefined" ? window : globalThis);
