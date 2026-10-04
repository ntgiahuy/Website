<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

require_admin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  $rows = db()->query('SELECT * FROM members ORDER BY updated_at DESC LIMIT 500')->fetchAll();
  $list = array_map(static fn($r) => member_public($r), $rows);
  json_out(['ok' => true, 'members' => $list]);
}

if ($method === 'POST') {
  $body = read_json_body();
  $action = (string) ($body['action'] ?? 'grant');
  $email = normalize_email((string) ($body['email'] ?? ''));

  if ($action === 'revoke') {
    json_out(revoke_member($email));
  }

  if ($action === 'delete') {
    db()->prepare('DELETE FROM members WHERE email = ?')->execute([$email]);
    json_out(['ok' => true]);
  }

  $plan = (string) ($body['plan'] ?? '');
  $days = isset($body['days']) && $body['days'] !== '' && $body['days'] !== null
    ? (int) $body['days']
    : null;
  $note = trim((string) ($body['note'] ?? ''));
  $result = grant_member($email, $plan, $days, $note);
  json_out($result, !empty($result['ok']) ? 200 : 400);
}

json_out(['ok' => false, 'error' => 'Method not allowed'], 405);
