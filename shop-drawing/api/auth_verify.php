<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['ok' => false, 'error' => 'POST only'], 405);
}

$body = read_json_body();
$email = normalize_email((string) ($body['email'] ?? ''));
$code = (string) ($body['code'] ?? '');
$token = (string) ($body['token'] ?? '');

$result = verify_otp($email, $code, $token);
if (empty($result['ok'])) {
  json_out($result, 400);
}

$access = access_snapshot();
json_out([
  'ok' => true,
  'email' => $result['email'],
  'member' => $result['member'],
  'access' => $access,
]);
