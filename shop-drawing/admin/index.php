<?php
declare(strict_types=1);
// Trang admin tĩnh + gọi API; bootstrap chỉ để báo nếu thiếu config khi mở trực tiếp PHP.
$configOk = is_file(dirname(__DIR__) . '/config.php');
?><!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Admin · Thành viên email GIAHUY</title>
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
    .lead { color: var(--muted); margin: 0 0 1.4rem; }
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
    #app[hidden], #login-box[hidden] { display: none !important; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Admin · Thành viên email</h1>
    <p class="lead">Cấp / gia hạn gói theo email đã xác nhận OTP. Dữ liệu lưu SQLite trên hosting.</p>

    <?php if (!$configOk): ?>
    <div class="warn">Chưa có <code>config.php</code> — sao chép <code>config.sample.php</code> thành <code>config.php</code> và điền SMTP + mật khẩu admin.</div>
    <?php endif; ?>

    <div class="panel" id="login-box">
      <h2>Đăng nhập admin</h2>
      <label>Tài khoản</label>
      <input id="user" autocomplete="username" />
      <label>Mật khẩu</label>
      <input id="pass" type="password" autocomplete="current-password" />
      <div class="row">
        <button class="btn" type="button" id="btn-login">Đăng nhập</button>
      </div>
      <p class="msg" id="login-msg"></p>
    </div>

    <div id="app" hidden>
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
          <button class="btn ghost" type="button" id="btn-logout">Đăng xuất admin</button>
        </div>
        <p class="msg" id="grant-msg"></p>
      </div>

      <div class="panel">
        <h2>Danh sách thành viên</h2>
        <div style="overflow:auto">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Gói</th>
                <th>Hết hạn</th>
                <th>Trạng thái</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody id="rows"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      var API = "../api/";
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
          throw new Error((data && data.error) || ("HTTP " + res.status));
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

      function showApp(on) {
        document.getElementById("app").hidden = !on;
        document.getElementById("login-box").hidden = on;
      }

      document.getElementById("btn-login").addEventListener("click", async function () {
        try {
          await api("admin_login.php", {
            method: "POST",
            body: {
              user: document.getElementById("user").value,
              pass: document.getElementById("pass").value,
            },
          });
          msg(document.getElementById("login-msg"), true, "Đăng nhập OK.");
          showApp(true);
          await loadPlans();
          await loadMembers();
        } catch (e) {
          msg(document.getElementById("login-msg"), false, e.message);
        }
      });

      document.getElementById("btn-logout").addEventListener("click", async function () {
        await api("admin_logout.php", { method: "POST", body: {} });
        showApp(false);
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
          await api("admin_members.php", {
            method: "POST",
            body: { action: "revoke", email: document.getElementById("email").value },
          });
          msg(document.getElementById("grant-msg"), true, "Đã thu hồi.");
          await loadMembers();
        } catch (e) {
          msg(document.getElementById("grant-msg"), false, e.message);
        }
      });

      document.getElementById("btn-delete").addEventListener("click", async function () {
        if (!confirm("Xóa hẳn email này khỏi DB?")) return;
        try {
          await api("admin_members.php", {
            method: "POST",
            body: { action: "delete", email: document.getElementById("email").value },
          });
          msg(document.getElementById("grant-msg"), true, "Đã xóa.");
          await loadMembers();
        } catch (e) {
          msg(document.getElementById("grant-msg"), false, e.message);
        }
      });

      document.getElementById("btn-refresh").addEventListener("click", async function () {
        try { await loadMembers(); msg(document.getElementById("grant-msg"), true, "Đã tải lại."); }
        catch (e) { msg(document.getElementById("grant-msg"), false, e.message); }
      });

      // Thử session sẵn
      (async function () {
        try {
          await api("admin_members.php");
          showApp(true);
          await loadPlans();
          await loadMembers();
        } catch (e) {
          showApp(false);
        }
      })();
    })();
  </script>
</body>
</html>
