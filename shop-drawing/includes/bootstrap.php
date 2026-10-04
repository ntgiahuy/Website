<?php
declare(strict_types=1);

require_once __DIR__ . '/polyfills.php';

header_remove('X-Powered-By');

if (PHP_VERSION_ID < 70400) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    'ok' => false,
    'error' => 'Hosting cần PHP >= 7.4 (hiện tại: ' . PHP_VERSION . '). Đổi phiên bản PHP trong cPanel.',
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

$configFile = dirname(__DIR__) . '/config.php';
if (!is_file($configFile)) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    'ok' => false,
    'error' => 'Thiếu config.php — trên hosting chạy: cp config.sample.php config.php rồi điền thông tin.',
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

/** @var array $CONFIG */
$CONFIG = require $configFile;
if (!is_array($CONFIG)) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    'ok' => false,
    'error' => 'config.php phải return [...] — kiểm tra lại cú pháp file.',
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

session_name($CONFIG['session_name'] ?? 'GHSID');
$cookiePath = '/';
$script = (string) ($_SERVER['SCRIPT_NAME'] ?? '');
if (preg_match('#^(.*?/shop-drawing)(?:/|$)#', $script, $m)) {
  $cookiePath = $m[1] . '/';
} elseif (!empty($CONFIG['cookie_path'])) {
  $cookiePath = (string) $CONFIG['cookie_path'];
}
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
  || ((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

if (PHP_VERSION_ID >= 70300) {
  session_set_cookie_params([
    'lifetime' => 0,
    'path' => $cookiePath,
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
} else {
  session_set_cookie_params(0, $cookiePath, '', $secure, true);
}

if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/domains.php';
require_once __DIR__ . '/embed.php';

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
  return strtolower(trim((string) $email));
}

function valid_email(string $email): bool {
  return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

function normalize_username(?string $username): string {
  return strtolower(trim((string) $username));
}

function valid_username(string $username): bool {
  return (bool) preg_match('/^[a-z0-9_]{3,32}$/', $username);
}

function valid_password(string $password): bool {
  return strlen($password) >= 6 && strlen($password) <= 128;
}
