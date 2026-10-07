<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

$access = access_snapshot();
json_out([
  'ok' => true,
  'logged_in' => current_username() !== null || current_email() !== null,
  'username' => current_username(),
  'email' => current_email(),
  'member' => current_member(),
  'access' => $access,
]);
