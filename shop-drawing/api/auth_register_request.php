<?php
declare(strict_types=1);

try {
  require_once dirname(__DIR__) . '/includes/bootstrap.php';
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_out(['ok' => false, 'error' => 'POST only'], 405);
  }
  $body = read_json_body();
  $result = register_request(
    (string) ($body['username'] ?? ''),
    (string) ($body['email'] ?? ''),
    (string) ($body['password'] ?? ''),
    (string) ($body['phone'] ?? ''),
    (string) ($body['full_name'] ?? ($body['fullname'] ?? ''))
  );
  json_out($result, !empty($result['ok']) ? 200 : 400);
} catch (Throwable $e) {
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    'ok' => false,
    'error' => 'Đăng ký lỗi: ' . $e->getMessage(),
  ], JSON_UNESCAPED_UNICODE);
}
