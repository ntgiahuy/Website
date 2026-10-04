<?php
declare(strict_types=1);

function embed_deny_url(): string {
  return (string) (cfg('embed_deny_redirect') ?: 'https://www.giahuy.net/');
}

function embed_redirect_deny(): void {
  $url = embed_deny_url();
  header('Cache-Control: no-store');
  header('Location: ' . $url, true, 302);
  exit;
}

function embed_app_url(string $appId): string {
  $apps = cfg('apps', []);
  foreach ($apps as $app) {
    if (($app['id'] ?? '') === $appId) {
      return (string) ($app['url'] ?? '');
    }
  }
  return '';
}

function embed_referer_host(): string {
  $ref = (string) ($_SERVER['HTTP_REFERER'] ?? '');
  if ($ref === '') return '';
  $host = parse_url($ref, PHP_URL_HOST);
  return is_string($host) ? $host : '';
}

/**
 * Kiểm tra quyền nhúng iframe.
 * - Mở thẳng URL (Sec-Fetch-Dest: document) → từ chối
 * - Iframe + Referer thuộc allowlist → cho phép
 * - Iframe không Referer: vẫn render, JS kiểm tra tiếp (referrer/ancestorOrigins)
 */
function embed_server_decision(): array {
  $dest = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_DEST'] ?? ''));
  $mode = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_MODE'] ?? ''));
  $refererHost = embed_referer_host();

  // Điều hướng top-level rõ ràng
  if ($dest === 'document' || ($mode === 'navigate' && $dest !== 'iframe')) {
    return ['allow' => false, 'reason' => 'top_level', 'host' => $refererHost];
  }

  if ($dest === 'iframe' || $dest === 'frame') {
    if ($refererHost !== '' && !domain_is_allowed($refererHost)) {
      return ['allow' => false, 'reason' => 'domain_denied', 'host' => $refererHost];
    }
    if ($refererHost !== '' && domain_is_allowed($refererHost)) {
      return ['allow' => true, 'reason' => 'referer_ok', 'host' => $refererHost];
    }
    // Iframe nhưng thiếu Referer — để JS quyết
    return ['allow' => true, 'reason' => 'iframe_no_referer', 'host' => '', 'needs_js' => true];
  }

  // Trình duyệt cũ không gửi Sec-Fetch-*: Referer hợp lệ → cho qua, JS vẫn chặn nếu không nằm trong iframe
  if ($refererHost !== '') {
    if (domain_is_allowed($refererHost)) {
      return ['allow' => true, 'reason' => 'referer_ok_legacy', 'host' => $refererHost, 'needs_js' => true];
    }
    return ['allow' => false, 'reason' => 'domain_denied', 'host' => $refererHost];
  }

  // Không có tín hiệu iframe / Referer → coi như mở thẳng URL
  return ['allow' => false, 'reason' => 'no_signal', 'host' => ''];
}

function render_embed_shop(string $appId): void {
  $decision = embed_server_decision();
  if (empty($decision['allow'])) {
    embed_redirect_deny();
  }

  $shopUrl = embed_app_url($appId);
  if ($shopUrl === '') {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Shop chưa cấu hình.';
    exit;
  }

  $allowed = list_allowed_domains();
  $allowedHosts = [];
  foreach ($allowed as $row) {
    $d = $row['domain'];
    $allowedHosts[] = $d;
    $allowedHosts[] = 'www.' . $d;
  }
  $allowedHosts = array_values(array_unique($allowedHosts));
  $deny = embed_deny_url();
  $csp = frame_ancestors_csp();

  header('Content-Type: text/html; charset=utf-8');
  header('Cache-Control: no-store');
  header('Content-Security-Policy: ' . $csp);

  $allowedJson = json_encode($allowedHosts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  $denyJson = json_encode($deny, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  $serverOk = !empty($decision['reason']) && str_starts_with((string) $decision['reason'], 'referer_ok') ? 'true' : 'false';
  $shopEsc = htmlspecialchars($shopUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
  $appEsc = htmlspecialchars($appId, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

  echo <<<HTML
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>GIAHUY · {$appEsc}</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0b1016; }
    iframe { border: 0; width: 100%; height: 100%; display: block; background: #111; }
  </style>
</head>
<body>
  <iframe id="shop" src="{$shopEsc}" title="GIAHUY {$appEsc}" allow="download" referrerpolicy="no-referrer-when-downgrade"></iframe>
  <script>
    (function () {
      var ALLOWED = {$allowedJson};
      var DENY = {$denyJson};
      var SERVER_OK = {$serverOk};

      function normHost(h) {
        h = String(h || "").toLowerCase().replace(/^www\\./, "");
        return h;
      }
      function hostAllowed(h) {
        h = normHost(h);
        if (!h) return false;
        for (var i = 0; i < ALLOWED.length; i++) {
          if (normHost(ALLOWED[i]) === h) return true;
        }
        return false;
      }
      function goDeny() {
        try { window.top.location.href = DENY; }
        catch (e) { location.replace(DENY); }
      }

      // Mở thẳng URL (không nằm trong iframe) → về giahuy.net
      var inFrame = false;
      try { inFrame = window.top !== window.self; } catch (e) { inFrame = true; }
      if (!inFrame) { goDeny(); return; }

      if (ALLOWED.length === 0) { goDeny(); return; }

      var parentHost = "";
      try {
        if (location.ancestorOrigins && location.ancestorOrigins.length) {
          var ao = location.ancestorOrigins[0];
          parentHost = ao ? (new URL(ao)).hostname : "";
        }
      } catch (e) {}
      if (!parentHost && document.referrer) {
        try { parentHost = (new URL(document.referrer)).hostname; } catch (e2) {}
      }

      if (parentHost) {
        if (!hostAllowed(parentHost)) goDeny();
        return;
      }
      // Không đọc được parent: chỉ giữ nếu server đã xác nhận Referer
      if (!SERVER_OK) goDeny();
    })();
  </script>
</body>
</html>
HTML;
  exit;
}
