<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/includes/bootstrap.php';

require_admin();
if (!empty($_SESSION['admin_must_change'])) {
  json_out(['ok' => false, 'error' => 'Cần đổi mật khẩu admin trước.', 'must_change_password' => true], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  $base = rtrim((string) cfg('base_url', ''), '/');
  $apps = [
    'mong' => 'Shop drawing móng đơn',
    'cot' => 'Shop drawing cột',
    'dam' => 'Shop drawing dầm',
    'san' => 'Shop drawing sàn',
  ];
  $snippets = [];
  $appsOut = [];
  foreach ($apps as $id => $label) {
    $src = $base !== '' ? $base . '/' . $id . '/' : '../' . $id . '/';
    $html = '<iframe src="' . $src . '" width="100%" height="980" style="border:0" allow="download"></iframe>';
    $snippets[$id] = $html;
    $appsOut[] = [
      'id' => $id,
      'label' => $label,
      'embed_path' => '/' . $id . '/',
      'embed_url' => $src,
      'iframe' => $html,
      // Agent shop không cần đọc danh sách domain — cổng hosting kiểm tra.
      'agent_change' => 'upload_to_app_folder',
      'agent_note' => 'Upload build vào shop-drawing/' . $id . '/app/. Không đọc tab Đối tác trong app. Đối tác nhúng /shop-drawing/' . $id . '/ (cổng index.php).',
      'upload_path' => 'shop-drawing/' . $id . '/app/',
    ];
  }
  json_out([
    'ok' => true,
    'domains' => list_allowed_domains(),
    'snippets' => $snippets,
    'apps' => $appsOut,
    'deny_redirect' => embed_deny_url(),
  ]);
}

if ($method === 'POST') {
  $body = read_json_body();
  $action = (string) ($body['action'] ?? 'add');
  if ($action === 'remove' || $action === 'delete') {
    json_out(remove_allowed_domain((string) ($body['domain'] ?? '')));
  }
  $result = add_allowed_domain((string) ($body['domain'] ?? ''), (string) ($body['note'] ?? ''));
  json_out($result, !empty($result['ok']) ? 200 : 400);
}

json_out(['ok' => false, 'error' => 'Method not allowed'], 405);
