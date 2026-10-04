<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['ok' => false, 'error' => 'POST only'], 405);
}

$body = read_json_body();
$email = normalize_email((string) ($body['email'] ?? ''));
$result = create_and_send_otp($email);
json_out($result, !empty($result['ok']) ? 200 : 400);
