<?php
/**
 * Mở URL này trên trình duyệt để xem lỗi cấu hình:
 * https://domain.com/shop-drawing/api/health.php
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$out = [
  'ok' => true,
  'php' => PHP_VERSION,
  'php_ok' => PHP_VERSION_ID >= 70400,
  'pdo' => class_exists('PDO'),
  'pdo_sqlite' => class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers(), true),
  'config_exists' => is_file(dirname(__DIR__) . '/config.php'),
  'data_writable' => is_dir(dirname(__DIR__) . '/data') && is_writable(dirname(__DIR__) . '/data'),
  'openssl' => extension_loaded('openssl'),
  'errors' => [],
];

if (!$out['php_ok']) {
  $out['ok'] = false;
  $out['errors'][] = 'Cần PHP >= 7.4. Đổi trong cPanel → Select PHP Version.';
}
if (!$out['config_exists']) {
  $out['ok'] = false;
  $out['errors'][] = 'Thiếu config.php — copy từ config.sample.php.';
}
if (!$out['pdo_sqlite']) {
  $out['ok'] = false;
  $out['errors'][] = 'Thiếu pdo_sqlite — bật extension trong cPanel.';
}
if (!$out['data_writable']) {
  $out['ok'] = false;
  $out['errors'][] = 'data/ chưa ghi được — chmod 755 hoặc 775.';
}

if ($out['config_exists']) {
  try {
    $cfg = require dirname(__DIR__) . '/config.php';
    $out['config_is_array'] = is_array($cfg);
    $out['base_url'] = is_array($cfg) ? ($cfg['base_url'] ?? '') : null;
    $out['mail_mode'] = is_array($cfg) ? (($cfg['mail']['mode'] ?? '')) : null;
    if (!is_array($cfg)) {
      $out['ok'] = false;
      $out['errors'][] = 'config.php không return mảng.';
    }
  } catch (Throwable $e) {
    $out['ok'] = false;
    $out['errors'][] = 'Lỗi đọc config.php: ' . $e->getMessage();
  }
}

// Thử mở DB nếu đủ điều kiện
if ($out['ok'] || ($out['config_exists'] && $out['pdo_sqlite'] && $out['data_writable'])) {
  try {
    require_once dirname(__DIR__) . '/includes/bootstrap.php';
    db();
    $out['db_ok'] = true;
  } catch (Throwable $e) {
    $out['ok'] = false;
    $out['db_ok'] = false;
    $out['errors'][] = 'DB: ' . $e->getMessage();
  }
}

http_response_code($out['ok'] ? 200 : 500);
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
