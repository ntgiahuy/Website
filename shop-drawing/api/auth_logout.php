<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['ok' => false, 'error' => 'POST only'], 405);
}

logout_session();
json_out(['ok' => true]);
