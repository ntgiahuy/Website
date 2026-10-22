<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['ok' => false, 'error' => 'POST only'], 405);
}

$body = read_json_body();
$user = trim((string) ($body['user'] ?? ''));
$pass = (string) ($body['pass'] ?? '');

$cfgUser = (string) cfg('admin_user', 'giahuy');
$cfgPass = (string) cfg('admin_pass', 'GiahuyAdmin');
$hash = setting_get('admin_pass_hash');

$okUser = hash_equals($cfgUser, $user);
$okPass = false;
$usingDefault = false;

if ($hash) {
  $okPass = password_verify($pass, $hash);
} else {
  $okPass = hash_equals($cfgPass, $pass);
  $usingDefault = $okPass && (
    $cfgPass === 'GiahuyAdmin' ||
    $cfgPass === 'DOI_MAT_KHAU_MANH' ||
    setting_get('admin_must_change', '1') === '1'
  );
}

if (!$okUser || !$okPass) {
  json_out(['ok' => false, 'error' => 'Sai tài khoản hoặc mật khẩu admin.'], 401);
}

$mustChange = $usingDefault || setting_get('admin_must_change') === '1';
if (!$hash && ($cfgPass === 'GiahuyAdmin' || $cfgPass === 'DOI_MAT_KHAU_MANH')) {
  $mustChange = true;
}

session_regenerate_id(true);
$_SESSION['admin'] = true;
$_SESSION['admin_at'] = time();
$_SESSION['admin_must_change'] = $mustChange;

json_out([
  'ok' => true,
  'must_change_password' => $mustChange,
  'user' => $cfgUser,
  'message' => $mustChange
    ? 'Đăng nhập OK — hãy đổi mật khẩu ngay (lần đầu dùng mật khẩu mặc định).'
    : 'Đăng nhập OK.',
]);
