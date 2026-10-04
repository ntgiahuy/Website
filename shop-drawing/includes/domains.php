<?php
declare(strict_types=1);

/**
 * Chuẩn hóa tên miền: bỏ https://, path, www. → domain.com
 */
function normalize_domain(string $input): string {
  $s = trim(strtolower($input));
  if ($s === '') return '';
  // Cho phép dán URL đầy đủ
  if (str_contains($s, '://') || str_contains($s, '/')) {
    if (!str_contains($s, '://')) {
      $s = 'https://' . $s;
    }
    $host = parse_url($s, PHP_URL_HOST);
    $s = is_string($host) ? $host : $s;
  }
  $s = preg_replace('#:\d+$#', '', $s) ?? $s;
  $s = preg_replace('#^www\.#', '', $s) ?? $s;
  $s = trim($s, ". \t\n\r");
  if ($s === '' || !preg_match('/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i', $s)) {
    return '';
  }
  return $s;
}

function list_allowed_domains(): array {
  $rows = db()->query('SELECT domain, note, created_at FROM allowed_domains ORDER BY created_at DESC')->fetchAll();
  return array_map(static function ($r) {
    return [
      'domain' => $r['domain'],
      'note' => $r['note'] ?? '',
      'created_at' => (int) $r['created_at'],
    ];
  }, $rows);
}

function domain_is_allowed(string $hostOrUrl): bool {
  $norm = normalize_domain($hostOrUrl);
  if ($norm === '') return false;
  // Cùng máy hosting (hub /shop-drawing/) luôn được nhúng
  $own = normalize_domain((string) ($_SERVER['HTTP_HOST'] ?? ''));
  if ($own !== '' && $norm === $own) {
    return true;
  }
  $st = db()->prepare('SELECT 1 FROM allowed_domains WHERE domain = ? LIMIT 1');
  $st->execute([$norm]);
  return (bool) $st->fetchColumn();
}

function add_allowed_domain(string $input, string $note = ''): array {
  $domain = normalize_domain($input);
  if ($domain === '') {
    return ['ok' => false, 'error' => 'Tên miền không hợp lệ. Ví dụ: domain.com hoặc https://www.domain.com'];
  }
  $now = time();
  db()->prepare(
    'INSERT INTO allowed_domains (domain, note, created_at) VALUES (?, ?, ?)
     ON CONFLICT(domain) DO UPDATE SET note = excluded.note'
  )->execute([$domain, trim($note), $now]);
  return ['ok' => true, 'domain' => $domain];
}

function remove_allowed_domain(string $input): array {
  $domain = normalize_domain($input);
  if ($domain === '') {
    return ['ok' => false, 'error' => 'Tên miền không hợp lệ.'];
  }
  db()->prepare('DELETE FROM allowed_domains WHERE domain = ?')->execute([$domain]);
  return ['ok' => true, 'domain' => $domain];
}

/** CSP frame-ancestors cho mọi domain đã cấp (www + non-www, http + https). */
function frame_ancestors_csp(): string {
  $parts = ["'self'"];
  foreach (list_allowed_domains() as $row) {
    $d = $row['domain'];
    foreach ([$d, 'www.' . $d] as $host) {
      $parts[] = 'https://' . $host;
      $parts[] = 'http://' . $host;
    }
  }
  return 'frame-ancestors ' . implode(' ', array_unique($parts));
}
