<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

$pay = cfg('pay', []);
$plans = cfg('plans', []);
$apps = cfg('apps', []);

json_out([
  'ok' => true,
  'trial_minutes' => (int) (cfg('trial_minutes') ?? 30),
  'trial_allow_pdf' => (bool) cfg('trial_allow_pdf'),
  'plans' => $plans,
  'apps' => $apps,
  'pay' => [
    'bank' => $pay['bank'] ?? '',
    'account' => $pay['account'] ?? '',
    'holder' => $pay['holder'] ?? '',
    'note' => $pay['note'] ?? '',
  ],
  'base_url' => cfg('base_url', ''),
]);
