<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['ok' => false, 'error' => 'POST only'], 405);
}

require_admin();

$body = read_json_body();
$current = (string) ($body['current'] ?? '');
$new = (string) ($body['new'] ?? '');
$confirm = (string) ($body['confirm'] ?? $body['new_confirm'] ?? '');

if ($new === '' || strlen($new) < 8) {
  json_out(['ok' => false, 'error' => 'Mật khẩu mới tối thiểu 8 ký tự.'], 400);
}
if ($new !== $confirm) {
  json_out(['ok' => false, 'error' => 'Xác nhận mật khẩu mới không khớp.'], 400);
}
if (in_array($new, ['GiahuyAdmin', 'DOI_MAT_KHAU_MANH', 'admin'], true)) {
  json_out(['ok' => false, 'error' => 'Không dùng lại mật khẩu mặc định.'], 400);
}

$hash = setting_get('admin_pass_hash');
$cfgUser = (string) cfg('admin_user', 'giahuy');
$cfgPass = (string) cfg('admin_pass', 'GiahuyAdmin');

$currentOk = false;
if ($hash) {
  $currentOk = password_verify($current, $hash);
} else {
  $currentOk = hash_equals($cfgPass, $current);
}
if (!$currentOk) {
  json_out(['ok' => false, 'error' => 'Mật khẩu hiện tại không đúng.'], 400);
}

setting_set('admin_pass_hash', password_hash($new, PASSWORD_DEFAULT));
setting_set('admin_must_change', '0');
setting_set('admin_pass_changed_at', (string) time());
$_SESSION['admin_must_change'] = false;

json_out([
  'ok' => true,
  'message' => 'Đã đổi mật khẩu. Dùng mật khẩu mới từ lần đăng nhập sau.',
  'user' => $cfgUser,
]);
