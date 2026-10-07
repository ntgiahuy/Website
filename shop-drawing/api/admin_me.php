<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

if (empty($_SESSION['admin'])) {
  json_out(['ok' => false, 'logged_in' => false], 401);
}

json_out([
  'ok' => true,
  'logged_in' => true,
  'user' => (string) cfg('admin_user', 'giahuy'),
  'must_change_password' => !empty($_SESSION['admin_must_change']),
  'domain_count' => count(list_allowed_domains()),
]);
