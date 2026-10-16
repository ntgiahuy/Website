<?php
declare(strict_types=1);

try {
  require_once dirname(__DIR__) . '/includes/bootstrap.php';

  $pay = cfg('pay', []);
  $plans = cfg('plans', []);
  $rawApps = cfg('apps', []);
  $base = rtrim((string) cfg('base_url', ''), '/');

  // Chuẩn hóa URL hub: mỗi app một cổng riêng ./mong/ ./cot/ ...
  $apps = [];
  foreach ($rawApps as $app) {
    if (!is_array($app)) continue;
    $id = (string) ($app['id'] ?? '');
    $row = $app;
    $coming = !empty($app['comingSoon']);
    if ($id !== '' && !$coming) {
      // Nếu config cũ để url = app/ cho mọi app → sửa thành cổng theo id
      $url = trim((string) ($app['url'] ?? ''));
      if ($url === '' || $url === 'app/' || $url === './app/' || $url === 'app') {
        $row['url'] = $base !== '' ? ($base . '/' . $id . '/') : ('./' . $id . '/');
      } elseif (preg_match('#^\./#', $url) || preg_match('#^https?://#i', $url)) {
        $row['url'] = $url;
      } else {
        $row['url'] = $base !== '' ? ($base . '/' . $id . '/') : ('./' . $id . '/');
      }
    }
    // Không lộ đường dẫn nội bộ content ra client nếu không cần
    unset($row['content']);
    $apps[] = $row;
  }

  json_out([
    'ok' => true,
    'trial_minutes' => (int) (cfg('trial_minutes') ?? 30),
    'trial_allow_pdf' => (bool) cfg('trial_allow_pdf'),
    'plans' => $plans,
    'apps' => $apps,
    'pay' => [
      'bank' => $pay['bank'] ?? '',
      'account' => $pay['account'] ?? '',
      'holder' => $pay['holder'] ?? '',
      'note' => $pay['note'] ?? '',
    ],
    'base_url' => cfg('base_url', ''),
  ]);
} catch (Throwable $e) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    'ok' => false,
    'error' => 'API lỗi: ' . $e->getMessage(),
  ], JSON_UNESCAPED_UNICODE);
}
