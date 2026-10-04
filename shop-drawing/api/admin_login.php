<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['ok' => false, 'error' => 'POST only'], 405);
}

$body = read_json_body();
$user = trim((string) ($body['user'] ?? ''));
$pass = (string) ($body['pass'] ?? '');

$okUser = hash_equals((string) cfg('admin_user', 'admin'), $user);
$okPass = hash_equals((string) cfg('admin_pass', ''), $pass);

if (!$okUser || !$okPass || cfg('admin_pass') === 'DOI_MAT_KHAU_MANH') {
  json_out(['ok' => false, 'error' => 'Sai tài khoản/mật khẩu admin (hoặc chưa đổi mật khẩu mẫu).'], 401);
}

session_regenerate_id(true);
$_SESSION['admin'] = true;
$_SESSION['admin_at'] = time();
json_out(['ok' => true]);
