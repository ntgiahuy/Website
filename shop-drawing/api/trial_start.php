<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['ok' => false, 'error' => 'POST only'], 405);
}

$bk = browser_key_from_request();
$result = start_trial($bk);
if (empty($result['ok'])) {
  json_out(array_merge($result, ['access' => access_snapshot($bk)]), 400);
}
json_out([
  'ok' => true,
  'trial' => $result['trial'],
  'resumed' => !empty($result['resumed']),
  'access' => access_snapshot($bk),
]);
