<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

$bk = browser_key_from_request();
json_out([
  'ok' => true,
  'access' => access_snapshot($bk),
]);
