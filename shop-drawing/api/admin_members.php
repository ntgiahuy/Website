<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

require_admin();
if (!empty($_SESSION['admin_must_change'])) {
  json_out(['ok' => false, 'error' => 'Cần đổi mật khẩu admin trước.', 'must_change_password' => true], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  $rows = db()->query('SELECT * FROM members ORDER BY updated_at DESC LIMIT 500')->fetchAll();
  $list = array_map(static function ($r) {
    return member_public($r);
  }, $rows);
  json_out(['ok' => true, 'members' => $list]);
}

if ($method === 'POST') {
  $body = read_json_body();
  $action = (string) ($body['action'] ?? 'grant');
  $username = normalize_username((string) ($body['username'] ?? ($body['email'] ?? '')));
  // Cho phép admin dán email cũ: nếu không phải username hợp lệ thì tìm theo email
  if (!valid_username($username) && valid_email(normalize_email((string) ($body['username'] ?? ($body['email'] ?? ''))))) {
    $byEmail = member_row(normalize_email((string) ($body['username'] ?? ($body['email'] ?? ''))));
    $username = normalize_username((string) ($byEmail['username'] ?? ''));
  }

  if ($action === 'revoke') {
    json_out(revoke_member($username), valid_username($username) ? 200 : 400);
  }

  if ($action === 'delete') {
    if (!valid_username($username)) {
      json_out(['ok' => false, 'error' => 'Username không hợp lệ.'], 400);
    }
    db()->prepare('DELETE FROM members WHERE username = ?')->execute([$username]);
    json_out(['ok' => true]);
  }

  $plan = (string) ($body['plan'] ?? '');
  $days = isset($body['days']) && $body['days'] !== '' && $body['days'] !== null
    ? (int) $body['days']
    : null;
  $note = trim((string) ($body['note'] ?? ''));
  $result = grant_member($username, $plan, $days, $note);
  json_out($result, !empty($result['ok']) ? 200 : 400);
}

json_out(['ok' => false, 'error' => 'Method not allowed'], 405);
