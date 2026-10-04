<?php
declare(strict_types=1);
$configOk = is_file(dirname(__DIR__) . '/config.php');
?><!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin · Thành viên email</title>
  <link rel="icon" href="../assets/icon.png" />
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #10161d; --ink: #e8eef4; --muted: #93a4b5; --line: rgba(232,238,244,.12);
      --amber: #e8a317; --ok: #3ecf8e; --danger: #ff6b6b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: "Be Vietnam Pro", sans-serif; color: var(--ink);
      background: linear-gradient(180deg, #0f1419, #182029); min-height: 100vh; line-height: 1.5;
    }
    .wrap { width: min(100% - 2rem, 920px); margin: 0 auto; padding: 1.5rem 0 3rem; }
    h1 { font-size: 1.55rem; letter-spacing: -0.02em; margin: 0 0 0.35rem; }
    .lead { color: var(--muted); margin: 0 0 1rem; }
    .panel {
      border: 1px solid var(--line); border-radius: 14px; padding: 1.1rem; margin-bottom: 1rem;
      background: rgba(0,0,0,.2);
    }
    h2 { font-size: 1.05rem; margin: 0 0 0.8rem; }
    label { display: block; font-size: 0.85rem; color: var(--muted); margin: 0.55rem 0 0.3rem; }
    input, select, textarea {
      width: 100%; font: inherit; color: var(--ink); background: #0c1116;
      border: 1px solid var(--line); border-radius: 10px; padding: 0.7rem 0.85rem;
    }
    textarea { min-height: 4.5rem; font-family: "IBM Plex Mono", monospace; font-size: 0.8rem; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    @media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }
    .row { display: flex; flex-wrap: wrap; gap: 0.55rem; margin-top: 0.85rem; }
    .btn {
      appearance: none; border: 0; cursor: pointer; font: inherit; font-weight: 700;
      border-radius: 10px; padding: 0.7rem 1rem; background: var(--amber); color: #1a1203;
    }
    .btn.ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); }
    .btn.danger { background: transparent; color: var(--danger); border: 1px solid rgba(255,107,107,.35); }
    .msg { margin-top: 0.75rem; font-size: 0.9rem; white-space: pre-wrap; }
    .msg.ok { color: var(--ok); }
    .msg.bad { color: var(--danger); }
    .mono { font-family: "IBM Plex Mono", monospace; word-break: break-all; font-size: 0.82rem; }
    a { color: var(--amber); }
    .warn {
      border: 1px solid rgba(232,163,23,.35); background: rgba(232,163,23,.08);
      border-radius: 10px; padding: 0.8rem 0.9rem; color: var(--muted); font-size: 0.9rem; margin-bottom: 1rem;
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.55rem 0.35rem; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { color: var(--muted); font-weight: 600; }
    .tag { display: inline-block; padding: 0.15rem 0.45rem; border-radius: 999px; font-size: 0.75rem; border: 1px solid var(--line); }
    .tag.ok { color: var(--ok); border-color: rgba(62,207,142,.35); }
    .tag.bad { color: var(--danger); border-color: rgba(255,107,107,.35); }
    #app[hidden], #login-box[hidden], #pwd-box[hidden], #pwd-inline[hidden] { display: none !important; }
    .hint { color: var(--muted); font-size: 0.86rem; margin: 0.35rem 0 0; }
    .tabs-admin { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem; }
    .tabs-admin button[data-pane] {
      appearance: none; border: 1px solid var(--line); background: transparent; color: var(--muted);
      font: inherit; font-weight: 700; border-radius: 999px; padding: 0.45rem 0.95rem; cursor: pointer;
    }
    .tabs-admin button[data-pane].active { background: var(--amber); color: #1a1203; border-color: var(--amber); }
    .pane[hidden] { display: none !important; }
    .snip-label { font-weight: 700; color: var(--ink); margin-top: 0.85rem; }
    .snip-label span { color: var(--muted); font-weight: 500; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1 id="page-title">Admin · Thành viên email</h1>
    <p class="lead" id="page-lead">Cấp / gia hạn gói theo email đã xác nhận OTP. Dữ liệu lưu SQLite trên hosting.</p>

    <?php if (!$configOk): ?>
    <div class="warn">Chưa có <code>config.php</code> — sao chép <code>config.sample.php</code> thành <code>config.php</code>.</div>
    <?php else: ?>
    <div class="warn" id="first-login-warn">Lần đầu đăng nhập: <strong>giahuy</strong> / <strong>GiahuyAdmin</strong> — đổi mật khẩu ngay.</div>
    <?php endif; ?>

    <div class="panel" id="login-box">
      <h2>Đăng nhập admin</h2>
      <label>Tài khoản</label>
      <input id="user" autocomplete="username" placeholder="giahuy" />
      <label>Mật khẩu</label>
      <input id="pass" type="password" autocomplete="current-password" />
      <div class="row">
        <button class="btn" type="button" id="btn-login">Đăng nhập</button>
      </div>
      <p class="msg" id="login-msg"></p>
    </div>

    <div class="panel" id="pwd-box" hidden>
      <h2>Đổi mật khẩu (bắt buộc lần đầu)</h2>
      <label>Mật khẩu hiện tại</label>
      <input id="pwd-current" type="password" autocomplete="current-password" />
      <label>Mật khẩu mới (≥ 8 ký tự)</label>
      <input id="pwd-new" type="password" autocomplete="new-password" />
      <label>Nhập lại mật khẩu mới</label>
      <input id="pwd-confirm" type="password" autocomplete="new-password" />
      <div class="row">
        <button class="btn" type="button" id="btn-pwd">Lưu mật khẩu mới</button>
      </div>
      <p class="msg" id="pwd-msg"></p>
    </div>

    <div id="app" hidden>
      <div class="tabs-admin">
        <button type="button" class="active" data-pane="members">Thành viên</button>
        <button type="button" data-pane="partners">Đối tác</button>
        <button type="button" class="btn ghost" id="btn-pwd-toggle" style="margin-left:auto;padding:0.45rem 0.85rem">Đổi mật khẩu</button>
        <button type="button" class="btn ghost" id="btn-logout" style="padding:0.45rem 0.85rem">Đăng xuất</button>
      </div>

      <div class="panel" id="pwd-inline" hidden>
        <h2>Đổi mật khẩu admin</h2>
        <label>Mật khẩu hiện tại</label>
        <input id="pwd2-current" type="password" autocomplete="current-password" />
        <label>Mật khẩu mới</label>
        <input id="pwd2-new" type="password" autocomplete="new-password" />
        <label>Nhập lại</label>
        <input id="pwd2-confirm" type="password" autocomplete="new-password" />
        <div class="row">
          <button class="btn" type="button" id="btn-pwd2">Lưu</button>
        </div>
        <p class="msg" id="pwd2-msg"></p>
      </div>

      <!-- Tab Thành viên (hình 1) -->
      <div class="pane" id="pane-members">
        <div class="panel">
          <h2>Cấp quyền thành viên</h2>
          <div class="grid2">
            <div>
              <label>Email khách</label>
              <input id="email" type="email" placeholder="khach@email.com" />
            </div>
            <div>
              <label>Gói</label>
              <select id="plan"></select>
            </div>
          </div>
          <label>Ghi chú (tuỳ chọn)</label>
          <input id="note" placeholder="Đã CK BIDV…" />
          <div class="row">
            <button class="btn" type="button" id="btn-grant">Cấp / Gia hạn</button>
            <button class="btn ghost" type="button" id="btn-revoke">Thu hồi (hết hạn ngay)</button>
            <button class="btn danger" type="button" id="btn-delete">Xóa dòng</button>
            <button class="btn ghost" type="button" id="btn-refresh">Tải lại danh sách</button>
          </div>
          <p class="msg" id="grant-msg"></p>
        </div>
        <div class="panel">
          <h2>Danh sách thành viên</h2>
          <div style="overflow:auto">
            <table>
              <thead>
                <tr><th>Email</th><th>Gói</th><th>Hết hạn</th><th>Trạng thái</th><th>Ghi chú</th></tr>
              </thead>
              <tbody id="rows"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab Đối tác (hình 2) -->
      <div class="pane" id="pane-partners" hidden>
        <div class="panel">
          <h2>Thêm tên miền được nhúng</h2>
          <p class="hint">Chấp nhận <span class="mono">domain.com</span>, <span class="mono">www.domain.com</span>, có/không <span class="mono">https://</span>. www và không www = một tên miền.</p>
          <div class="grid2">
            <div>
              <label>Tên miền</label>
              <input id="domain" placeholder="domain.com" />
            </div>
            <div>
              <label>Ghi chú</label>
              <input id="domain-note" placeholder="Đối tác ABC" />
            </div>
          </div>
          <div class="row">
            <button class="btn" type="button" id="btn-add-domain">Thêm tên miền</button>
            <button class="btn ghost" type="button" id="btn-reload-domains">Tải lại</button>
          </div>
          <p class="msg" id="domain-msg"></p>
        </div>

        <div class="panel">
          <h2>Danh sách tên miền đã cấp</h2>
          <div style="overflow:auto">
            <table>
              <thead>
                <tr><th>Tên miền</th><th>Ghi chú</th><th></th></tr>
              </thead>
              <tbody id="domain-rows"></tbody>
            </table>
          </div>
          <p class="hint" id="deny-hint" style="margin-top:0.85rem"></p>
        </div>

        <div class="panel">
          <h2>Mã nhúng cho đối tác</h2>
          <p class="hint">Dán vào site đã được cấp tên miền ở tab Đối tác. Mở thẳng URL hoặc site chưa cấp → chuyển về giahuy.net.</p>
          <p class="hint" style="margin-top:0.5rem">Upload build agent vào <span class="mono">shop-drawing/{mong|cot|dam|san}/app/</span>. Cổng <span class="mono">.../mong/</span> (v.v.) kiểm tra tên miền từ tab Đối tác rồi mới mở <span class="mono">app/</span>. Agents <strong>không</strong> tự đọc danh sách domain.</p>

          <p class="snip-label">Shop drawing móng đơn <span>· mong</span></p>
          <textarea id="snip-mong" readonly></textarea>
          <p class="snip-label">Shop drawing cột <span>· cot</span></p>
          <textarea id="snip-cot" readonly></textarea>
          <p class="snip-label">Shop drawing dầm <span>· dam</span></p>
          <textarea id="snip-dam" readonly></textarea>
          <p class="snip-label">Shop drawing sàn <span>· san</span></p>
          <textarea id="snip-san" readonly></textarea>
        </div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      var API = "../api/";
      var titles = {
        members: {
          title: "Admin · Thành viên email",
          lead: "Cấp / gia hạn gói theo email đã xác nhận OTP. Dữ liệu lưu SQLite trên hosting.",
        },
        partners: {
          title: "Admin · Đối tác (tên miền iframe)",
          lead: "Cấp tên miền được nhúng shop thép. Site chưa cấp hoặc mở thẳng URL → giahuy.net.",
        },
      };

      async function api(path, opts) {
        opts = opts || {};
        var res = await fetch(API + path, {
          method: opts.method || "GET",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          cache: "no-store",
        });
        var data = await res.json().catch(function () { return null; });
        if (!res.ok || !data || data.ok === false) {
          var err = new Error((data && data.error) || ("HTTP " + res.status));
          err.data = data;
          throw err;
        }
        return data;
      }
      function msg(el, ok, text) {
        el.className = "msg " + (ok ? "ok" : "bad");
        el.textContent = text || "";
      }
      function moneyDate(ts) {
        if (!ts) return "—";
        try { return new Date(ts * 1000).toLocaleString("vi-VN"); } catch (e) { return String(ts); }
      }

      function showLogin() {
        document.getElementById("login-box").hidden = false;
        document.getElementById("pwd-box").hidden = true;
        document.getElementById("app").hidden = true;
      }
      function showPwdGate() {
        document.getElementById("login-box").hidden = true;
        document.getElementById("pwd-box").hidden = false;
        document.getElementById("app").hidden = true;
      }
      function showApp() {
        document.getElementById("login-box").hidden = true;
        document.getElementById("pwd-box").hidden = true;
        document.getElementById("app").hidden = false;
        var w = document.getElementById("first-login-warn");
        if (w) w.hidden = true;
      }

      function setPane(id) {
        document.querySelectorAll(".tabs-admin button[data-pane]").forEach(function (b) {
          b.classList.toggle("active", b.getAttribute("data-pane") === id);
        });
        document.getElementById("pane-members").hidden = id !== "members";
        document.getElementById("pane-partners").hidden = id !== "partners";
        var t = titles[id] || titles.members;
        document.getElementById("page-title").textContent = t.title;
        document.getElementById("page-lead").textContent = t.lead;
        document.title = t.title;
      }

      document.querySelectorAll(".tabs-admin button[data-pane]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          setPane(btn.getAttribute("data-pane"));
        });
      });

      async function loadDomains() {
        var data = await api("admin_domains.php");
        var tb = document.getElementById("domain-rows");
        tb.innerHTML = "";
        (data.domains || []).forEach(function (d) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            '<td class="mono">' + d.domain + "</td>" +
            "<td>" + (d.note || "") + "</td>" +
            '<td><button type="button" class="btn danger" style="padding:0.35rem 0.65rem">Xóa</button></td>';
          tr.querySelector("button").addEventListener("click", async function () {
            if (!confirm("Xóa tên miền " + d.domain + "?")) return;
            try {
              await api("admin_domains.php", { method: "POST", body: { action: "remove", domain: d.domain } });
              await loadDomains();
              msg(document.getElementById("domain-msg"), true, "Đã xóa " + d.domain);
            } catch (e) {
              msg(document.getElementById("domain-msg"), false, e.message);
            }
          });
          tb.appendChild(tr);
        });
        var sn = data.snippets || {};
        document.getElementById("snip-mong").value = sn.mong || "";
        document.getElementById("snip-cot").value = sn.cot || "";
        document.getElementById("snip-dam").value = sn.dam || "";
        document.getElementById("snip-san").value = sn.san || "";
        document.getElementById("deny-hint").textContent =
          "Tên miền chưa cấp hoặc mở thẳng URL shop → chuyển về " + (data.deny_redirect || "https://www.giahuy.net/");
      }

      async function loadPlans() {
        var cfg = await api("config.php");
        var sel = document.getElementById("plan");
        sel.innerHTML = "";
        (cfg.plans || []).forEach(function (p) {
          var o = document.createElement("option");
          o.value = p.id;
          o.textContent = p.label + " (" + p.days + " ngày)";
          sel.appendChild(o);
        });
      }

      async function loadMembers() {
        var data = await api("admin_members.php");
        var tb = document.getElementById("rows");
        tb.innerHTML = "";
        (data.members || []).forEach(function (m) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            '<td class="mono">' + (m.email || "") + "</td>" +
            "<td>" + (m.plan || "—") + "</td>" +
            "<td>" + moneyDate(m.expires_at) + "</td>" +
            '<td><span class="tag ' + (m.active ? "ok" : "bad") + '">' + (m.active ? "Còn hạn" : "Hết hạn") + "</span></td>" +
            "<td>" + (m.note || "") + "</td>";
          tr.addEventListener("click", function () {
            document.getElementById("email").value = m.email || "";
            if (m.plan) document.getElementById("plan").value = m.plan;
            document.getElementById("note").value = m.note || "";
          });
          tb.appendChild(tr);
        });
      }

      async function afterLogin(mustChange) {
        if (mustChange) {
          showPwdGate();
          return;
        }
        showApp();
        setPane("members");
        await loadPlans();
        await loadMembers();
        await loadDomains();
      }

      async function changePassword(currentId, newId, confirmId, msgId, thenApp) {
        try {
          var data = await api("admin_password.php", {
            method: "POST",
            body: {
              current: document.getElementById(currentId).value,
              new: document.getElementById(newId).value,
              confirm: document.getElementById(confirmId).value,
            },
          });
          msg(document.getElementById(msgId), true, data.message || "Đã đổi mật khẩu.");
          if (thenApp) await afterLogin(false);
        } catch (e) {
          msg(document.getElementById(msgId), false, e.message);
        }
      }

      document.getElementById("btn-login").addEventListener("click", async function () {
        try {
          var data = await api("admin_login.php", {
            method: "POST",
            body: {
              user: document.getElementById("user").value,
              pass: document.getElementById("pass").value,
            },
          });
          msg(document.getElementById("login-msg"), true, data.message || "OK");
          await afterLogin(!!data.must_change_password);
        } catch (e) {
          msg(document.getElementById("login-msg"), false, e.message);
        }
      });

      document.getElementById("btn-pwd").addEventListener("click", function () {
        changePassword("pwd-current", "pwd-new", "pwd-confirm", "pwd-msg", true);
      });
      document.getElementById("btn-pwd2").addEventListener("click", function () {
        changePassword("pwd2-current", "pwd2-new", "pwd2-confirm", "pwd2-msg", false);
      });
      document.getElementById("btn-pwd-toggle").addEventListener("click", function () {
        var box = document.getElementById("pwd-inline");
        box.hidden = !box.hidden;
      });

      document.getElementById("btn-logout").addEventListener("click", async function () {
        await api("admin_logout.php", { method: "POST", body: {} });
        showLogin();
      });

      document.getElementById("btn-add-domain").addEventListener("click", async function () {
        try {
          var data = await api("admin_domains.php", {
            method: "POST",
            body: {
              action: "add",
              domain: document.getElementById("domain").value,
              note: document.getElementById("domain-note").value,
            },
          });
          msg(document.getElementById("domain-msg"), true, "Đã thêm: " + data.domain);
          document.getElementById("domain").value = "";
          await loadDomains();
        } catch (e) {
          msg(document.getElementById("domain-msg"), false, e.message);
        }
      });
      document.getElementById("btn-reload-domains").addEventListener("click", async function () {
        try { await loadDomains(); msg(document.getElementById("domain-msg"), true, "Đã tải lại."); }
        catch (e) { msg(document.getElementById("domain-msg"), false, e.message); }
      });

      document.getElementById("btn-grant").addEventListener("click", async function () {
        try {
          var data = await api("admin_members.php", {
            method: "POST",
            body: {
              action: "grant",
              email: document.getElementById("email").value,
              plan: document.getElementById("plan").value,
              note: document.getElementById("note").value,
            },
          });
          msg(document.getElementById("grant-msg"), true, "Đã cấp: " + data.member.email + " · hết hạn " + moneyDate(data.member.expires_at));
          await loadMembers();
        } catch (e) {
          msg(document.getElementById("grant-msg"), false, e.message);
        }
      });
      document.getElementById("btn-revoke").addEventListener("click", async function () {
        try {
          await api("admin_members.php", { method: "POST", body: { action: "revoke", email: document.getElementById("email").value } });
          msg(document.getElementById("grant-msg"), true, "Đã thu hồi.");
          await loadMembers();
        } catch (e) { msg(document.getElementById("grant-msg"), false, e.message); }
      });
      document.getElementById("btn-delete").addEventListener("click", async function () {
        if (!confirm("Xóa hẳn email này khỏi DB?")) return;
        try {
          await api("admin_members.php", { method: "POST", body: { action: "delete", email: document.getElementById("email").value } });
          msg(document.getElementById("grant-msg"), true, "Đã xóa.");
          await loadMembers();
        } catch (e) { msg(document.getElementById("grant-msg"), false, e.message); }
      });
      document.getElementById("btn-refresh").addEventListener("click", async function () {
        try { await loadMembers(); msg(document.getElementById("grant-msg"), true, "Đã tải lại."); }
        catch (e) { msg(document.getElementById("grant-msg"), false, e.message); }
      });

      (async function () {
        try {
          var me = await api("admin_me.php");
          await afterLogin(!!me.must_change_password);
        } catch (e) {
          showLogin();
        }
      })();
    })();
  </script>
</body>
</html>
