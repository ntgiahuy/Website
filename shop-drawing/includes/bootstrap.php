<?php
declare(strict_types=1);

header_remove('X-Powered-By');

$configFile = dirname(__DIR__) . '/config.php';
if (!is_file($configFile)) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    'ok' => false,
    'error' => 'Thiếu config.php — sao chép config.sample.php thành config.php và điền thông tin.',
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

/** @var array $CONFIG */
$CONFIG = require $configFile;

session_name($CONFIG['session_name'] ?? 'GHSID');
// Cookie path theo thư mục shop-drawing (vd. /shop-drawing)
$cookiePath = '/';
$script = (string) ($_SERVER['SCRIPT_NAME'] ?? '');
if (preg_match('#^(.*?/shop-drawing)(?:/|$)#', $script, $m)) {
  $cookiePath = $m[1] . '/';
} elseif (!empty($CONFIG['cookie_path'])) {
  $cookiePath = (string) $CONFIG['cookie_path'];
}
session_set_cookie_params([
  'lifetime' => 0,
  'path' => $cookiePath,
  'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
  'httponly' => true,
  'samesite' => 'Lax',
]);
if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/auth.php';

function cfg(string $key, $default = null) {
  global $CONFIG;
  return $CONFIG[$key] ?? $default;
}

function json_out(array $data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function read_json_body(): array {
  static $cached = null;
  if ($cached !== null) return $cached;
  $raw = file_get_contents('php://input') ?: '';
  if ($raw === '') {
    $cached = $_POST ?: [];
    return $cached;
  }
  $data = json_decode($raw, true);
  $cached = is_array($data) ? $data : [];
  return $cached;
}

function normalize_email(?string $email): string {
  $email = strtolower(trim((string) $email));
  return $email;
}

function valid_email(string $email): bool {
  return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}
