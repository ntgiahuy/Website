<?php
declare(strict_types=1);

function member_row(?string $email): ?array {
  if (!$email) return null;
  $st = db()->prepare('SELECT * FROM members WHERE email = ?');
  $st->execute([$email]);
  $row = $st->fetch();
  return $row ?: null;
}

function member_is_active(?array $row): bool {
  if (!$row) return false;
  return (int) $row['expires_at'] > time();
}

function member_public(?array $row): ?array {
  if (!$row) return null;
  $exp = (int) $row['expires_at'];
  $active = $exp > time();
  $daysLeft = $active ? (int) max(0, ceil(($exp - time()) / 86400)) : 0;
  return [
    'email' => $row['email'],
    'plan' => $row['plan'],
    'expires_at' => $exp,
    'expires_at_iso' => gmdate('c', $exp),
    'active' => $active,
    'days_left' => $daysLeft,
    'note' => $row['note'] ?? '',
  ];
}

function current_email(): ?string {
  $email = $_SESSION['email'] ?? null;
  if (!$email || !valid_email((string) $email)) return null;
  return normalize_email((string) $email);
}

function current_member(): ?array {
  return member_public(member_row(current_email()));
}

function login_email(string $email): void {
  session_regenerate_id(true);
  $_SESSION['email'] = normalize_email($email);
  $_SESSION['logged_in_at'] = time();
}

function logout_session(): void {
  $_SESSION = [];
  if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'] ?? '/', $p['domain'] ?? '', (bool) ($p['secure'] ?? false), (bool) ($p['httponly'] ?? true));
  }
  session_destroy();
}

function generate_otp_code(): string {
  $len = max(4, min(8, (int) (cfg('otp_length') ?? 6)));
  $max = (10 ** $len) - 1;
  $n = random_int(0, $max);
  return str_pad((string) $n, $len, '0', STR_PAD_LEFT);
}

function otp_rate_limited(string $email): bool {
  $st = db()->prepare('SELECT created_at FROM otps WHERE email = ?');
  $st->execute([$email]);
  $row = $st->fetch();
  if (!$row) return false;
  return (time() - (int) $row['created_at']) < 45;
}

function create_and_send_otp(string $email): array {
  $email = normalize_email($email);
  if (!valid_email($email)) {
    return ['ok' => false, 'error' => 'Email không hợp lệ.'];
  }
  if (otp_rate_limited($email)) {
    return ['ok' => false, 'error' => 'Vui lòng đợi khoảng 1 phút trước khi gửi lại mã.'];
  }

  $code = generate_otp_code();
  $ttl = max(3, (int) (cfg('otp_ttl_minutes') ?? 10));
  $now = time();
  $token = bin2hex(random_bytes(24));
  $hash = password_hash($code, PASSWORD_DEFAULT);
  $tokenHash = hash('sha256', $token);

  $st = db()->prepare(
    'INSERT INTO otps (email, code_hash, token_hash, expires_at, attempts, created_at)
     VALUES (?, ?, ?, ?, 0, ?)
     ON CONFLICT(email) DO UPDATE SET
       code_hash = excluded.code_hash,
       token_hash = excluded.token_hash,
       expires_at = excluded.expires_at,
       attempts = 0,
       created_at = excluded.created_at'
  );
  $st->execute([$email, $hash, $tokenHash, $now + ($ttl * 60), $now]);

  $base = rtrim((string) cfg('base_url', ''), '/');
  $link = $base !== ''
    ? $base . '/thanh-vien/?email=' . rawurlencode($email) . '&token=' . rawurlencode($token)
    : '';

  $sent = send_otp_mail($email, $code, $link);
  if (empty($sent['ok'])) {
    return ['ok' => false, 'error' => $sent['error'] ?? 'Không gửi được email OTP.'];
  }

  return [
    'ok' => true,
    'email' => $email,
    'expires_in' => $ttl * 60,
    'message' => 'Đã gửi mã OTP (và link xác nhận) tới email của bạn.',
  ];
}

function verify_otp(string $email, string $code = '', string $token = ''): array {
  $email = normalize_email($email);
  if (!valid_email($email)) {
    return ['ok' => false, 'error' => 'Email không hợp lệ.'];
  }

  $st = db()->prepare('SELECT * FROM otps WHERE email = ?');
  $st->execute([$email]);
  $row = $st->fetch();
  if (!$row) {
    return ['ok' => false, 'error' => 'Chưa có mã OTP cho email này. Hãy gửi lại.'];
  }
  if ((int) $row['expires_at'] < time()) {
    return ['ok' => false, 'error' => 'Mã OTP đã hết hạn. Hãy gửi lại mã mới.'];
  }
  if ((int) $row['attempts'] >= 8) {
    return ['ok' => false, 'error' => 'Nhập sai quá nhiều lần. Hãy gửi lại mã mới.'];
  }

  $ok = false;
  $code = trim($code);
  $token = trim($token);
  if ($code !== '') {
    $ok = password_verify($code, (string) $row['code_hash']);
  } elseif ($token !== '' && !empty($row['token_hash'])) {
    $ok = hash_equals((string) $row['token_hash'], hash('sha256', $token));
  }

  if (!$ok) {
    db()->prepare('UPDATE otps SET attempts = attempts + 1 WHERE email = ?')->execute([$email]);
    return ['ok' => false, 'error' => 'Mã xác nhận không đúng.'];
  }

  db()->prepare('DELETE FROM otps WHERE email = ?')->execute([$email]);
  login_email($email);

  // Đảm bảo có dòng thành viên (có thể chưa được cấp gói)
  $existing = member_row($email);
  if (!$existing) {
    $now = time();
    db()->prepare(
      'INSERT INTO members (email, plan, expires_at, note, created_at, updated_at)
       VALUES (?, ?, 0, ?, ?, ?)'
    )->execute([$email, '', 'Chưa cấp gói', $now, $now]);
  }

  return [
    'ok' => true,
    'email' => $email,
    'member' => current_member(),
  ];
}

function grant_member(string $email, string $planId, ?int $days = null, string $note = ''): array {
  $email = normalize_email($email);
  if (!valid_email($email)) {
    return ['ok' => false, 'error' => 'Email không hợp lệ.'];
  }

  $plans = cfg('plans', []);
  $plan = null;
  foreach ($plans as $p) {
    if (($p['id'] ?? '') === $planId) {
      $plan = $p;
      break;
    }
  }
  if (!$plan && $days === null) {
    return ['ok' => false, 'error' => 'Gói không hợp lệ.'];
  }
  $useDays = $days !== null ? max(1, $days) : (int) ($plan['days'] ?? 30);
  $now = time();
  $row = member_row($email);
  $base = $now;
  if ($row && (int) $row['expires_at'] > $now) {
    $base = (int) $row['expires_at'];
  }
  $expires = $base + ($useDays * 86400);
  if ($planId === 'lifetime') {
    $expires = $now + (36500 * 86400);
  }

  if ($row) {
    db()->prepare(
      'UPDATE members SET plan = ?, expires_at = ?, note = ?, updated_at = ? WHERE email = ?'
    )->execute([$planId, $expires, $note, $now, $email]);
  } else {
    db()->prepare(
      'INSERT INTO members (email, plan, expires_at, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$email, $planId, $expires, $note, $now, $now]);
  }

  return ['ok' => true, 'member' => member_public(member_row($email))];
}

function revoke_member(string $email): array {
  $email = normalize_email($email);
  $st = db()->prepare('UPDATE members SET expires_at = 0, updated_at = ? WHERE email = ?');
  $st->execute([time(), $email]);
  return ['ok' => true, 'member' => member_public(member_row($email))];
}

function browser_key_from_request(): string {
  $key = trim((string) ($_SERVER['HTTP_X_BROWSER_KEY'] ?? ($_POST['browser_key'] ?? '')));
  if ($key === '') {
    $body = read_json_body();
    $key = trim((string) ($body['browser_key'] ?? ''));
  }
  if ($key === '' || !preg_match('/^[a-zA-Z0-9_-]{16,80}$/', $key)) {
    $key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . ($_SERVER['HTTP_USER_AGENT'] ?? ''));
  }
  return substr($key, 0, 80);
}

function trial_status(string $browserKey): array {
  $mins = max(1, (int) (cfg('trial_minutes') ?? 30));
  $st = db()->prepare('SELECT * FROM trials WHERE browser_key = ?');
  $st->execute([$browserKey]);
  $row = $st->fetch();
  $now = time();
  if (!$row) {
    return [
      'started' => false,
      'active' => false,
      'used_up' => false,
      'remaining_sec' => $mins * 60,
      'ends_at' => null,
      'trial_minutes' => $mins,
    ];
  }
  $ends = (int) $row['ends_at'];
  $remaining = max(0, $ends - $now);
  return [
    'started' => true,
    'active' => $remaining > 0,
    'used_up' => $remaining <= 0,
    'remaining_sec' => $remaining,
    'ends_at' => $ends,
    'started_at' => (int) $row['started_at'],
    'trial_minutes' => $mins,
  ];
}

function start_trial(string $browserKey): array {
  $st = trial_status($browserKey);
  if ($st['active']) {
    return ['ok' => true, 'trial' => $st, 'resumed' => true];
  }
  if ($st['used_up']) {
    return [
      'ok' => false,
      'error' => 'Bạn đã dùng hết lượt dùng thử trên trình duyệt này. Hãy đăng nhập email thành viên để tiếp tục.',
      'trial' => $st,
    ];
  }
  $mins = max(1, (int) (cfg('trial_minutes') ?? 30));
  $now = time();
  $ends = $now + ($mins * 60);
  db()->prepare(
    'INSERT INTO trials (browser_key, started_at, ends_at) VALUES (?, ?, ?)'
  )->execute([$browserKey, $now, $ends]);
  return ['ok' => true, 'trial' => trial_status($browserKey), 'resumed' => false];
}

function access_snapshot(?string $browserKey = null): array {
  $member = current_member();
  $email = current_email();
  $bk = $browserKey ?: browser_key_from_request();
  $trial = trial_status($bk);
  $allowPdf = !empty(cfg('trial_allow_pdf'));

  if ($member && !empty($member['active'])) {
    return [
      'allowed' => true,
      'mode' => 'member',
      'can_pdf' => true,
      'email' => $email,
      'member' => $member,
      'trial' => $trial,
    ];
  }
  if (!empty($trial['active'])) {
    return [
      'allowed' => true,
      'mode' => 'trial',
      'can_pdf' => $allowPdf,
      'email' => $email,
      'member' => $member,
      'trial' => $trial,
    ];
  }
  return [
    'allowed' => false,
    'mode' => !empty($trial['used_up']) ? 'trial_used' : 'locked',
    'can_pdf' => false,
    'email' => $email,
    'member' => $member,
    'trial' => $trial,
  ];
}

function require_admin(): void {
  if (empty($_SESSION['admin'])) {
    json_out(['ok' => false, 'error' => 'Cần đăng nhập admin.'], 401);
  }
}
