<?php
/**
 * Mở: https://domain.com/shop-drawing/api/health.php
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$out = [
  'ok' => true,
  'php' => PHP_VERSION,
  'php_ok' => PHP_VERSION_ID >= 70400,
  'pdo' => class_exists('PDO'),
  'pdo_drivers' => class_exists('PDO') ? PDO::getAvailableDrivers() : [],
  'pdo_sqlite' => class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers(), true),
  'pdo_mysql' => class_exists('PDO') && in_array('mysql', PDO::getAvailableDrivers(), true),
  'config_exists' => is_file(dirname(__DIR__) . '/config.php'),
  'data_writable' => is_dir(dirname(__DIR__) . '/data') && is_writable(dirname(__DIR__) . '/data'),
  'openssl' => extension_loaded('openssl'),
  'errors' => [],
  'hints' => [],
];

if (!$out['php_ok']) {
  $out['ok'] = false;
  $out['errors'][] = 'Cần PHP >= 7.4. Đổi trong cPanel → Select PHP Version.';
}
if (!$out['config_exists']) {
  $out['ok'] = false;
  $out['errors'][] = 'Thiếu config.php — copy từ config.sample.php.';
}

$dbDriverCfg = null;
$mysqlConfigured = false;
if ($out['config_exists']) {
  try {
    $cfg = require dirname(__DIR__) . '/config.php';
    $out['config_is_array'] = is_array($cfg);
    $out['base_url'] = is_array($cfg) ? ($cfg['base_url'] ?? '') : null;
    $out['mail_mode'] = is_array($cfg) ? (($cfg['mail']['mode'] ?? '')) : null;
    $dbDriverCfg = is_array($cfg) ? ($cfg['db_driver'] ?? 'auto') : 'auto';
    $mysqlConfigured = is_array($cfg)
      && !empty($cfg['mysql']['dbname'])
      && !empty($cfg['mysql']['user'])
      && ($cfg['mysql']['dbname'] ?? '') !== 'TEN_DATABASE';
    $out['db_driver_config'] = $dbDriverCfg;
    $out['mysql_configured'] = $mysqlConfigured;
    if (!is_array($cfg)) {
      $out['ok'] = false;
      $out['errors'][] = 'config.php không return mảng.';
    }
  } catch (Throwable $e) {
    $out['ok'] = false;
    $out['errors'][] = 'Lỗi đọc config.php: ' . $e->getMessage();
  }
}

if (!$out['pdo_sqlite'] && !$out['pdo_mysql']) {
  $out['ok'] = false;
  $out['errors'][] = 'Không có pdo_sqlite lẫn pdo_mysql.';
} elseif (!$out['pdo_sqlite'] && $out['pdo_mysql'] && !$mysqlConfigured) {
  $out['ok'] = false;
  $out['errors'][] = 'Hosting không có SQLite nhưng có MySQL. Trong config.php đặt db_driver => mysql và điền khối mysql (tạo DB trong cPanel).';
  $out['hints'][] = "Ví dụ:\n'db_driver' => 'mysql',\n'mysql' => ['host'=>'localhost','dbname'=>'xxx','user'=>'xxx','pass'=>'xxx','charset'=>'utf8mb4'],";
}

if ($out['pdo_sqlite'] && !$out['data_writable'] && (!$mysqlConfigured)) {
  $out['ok'] = false;
  $out['errors'][] = 'data/ chưa ghi được — chmod 755/775 (hoặc chuyển sang MySQL).';
}

if ($out['config_exists'] && ($out['pdo_sqlite'] || ($out['pdo_mysql'] && $mysqlConfigured))) {
  try {
    require_once dirname(__DIR__) . '/includes/bootstrap.php';
    db();
    $out['db_ok'] = true;
    $out['db_driver_active'] = db_driver();
  } catch (Throwable $e) {
    $out['ok'] = false;
    $out['db_ok'] = false;
    $out['errors'][] = 'DB: ' . $e->getMessage();
  }
}

http_response_code($out['ok'] ? 200 : 500);
echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
