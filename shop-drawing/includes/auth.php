<?php
declare(strict_types=1);

function member_row(?string $email): ?array {
  if (!$email) return null;
  $st = db()->prepare('SELECT * FROM members WHERE email = ?');
  $st->execute([$email]);
  $row = $st->fetch();
  return $row ?: null;
}

function member_row_by_username(?string $username): ?array {
  $username = normalize_username($username);
  if ($username === '' || !valid_username($username)) return null;
  $st = db()->prepare('SELECT * FROM members WHERE username = ?');
  $st->execute([$username]);
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
    'username' => (string) ($row['username'] ?? ''),
    'email' => $row['email'],
    'email_verified' => !empty($row['email_verified']),
    'plan' => $row['plan'],
    'expires_at' => $exp,
    'expires_at_iso' => gmdate('c', $exp),
    'active' => $active,
    'days_left' => $daysLeft,
    'note' => $row['note'] ?? '',
    'has_password' => !empty($row['password_hash']),
  ];
}

function current_email(): ?string {
  $email = $_SESSION['email'] ?? null;
  if (!$email || !valid_email((string) $email)) return null;
  return normalize_email((string) $email);
}

function current_username(): ?string {
  $u = normalize_username((string) ($_SESSION['username'] ?? ''));
  return valid_username($u) ? $u : null;
}

function current_member(): ?array {
  $email = current_email();
  if ($email) return member_public(member_row($email));
  $u = current_username();
  if ($u) return member_public(member_row_by_username($u));
  return null;
}

function login_member(array $row): void {
  session_regenerate_id(true);
  $_SESSION['email'] = normalize_email((string) $row['email']);
  $_SESSION['username'] = normalize_username((string) ($row['username'] ?? ''));
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

function pending_rate_limited(string $email): bool {
  $st = db()->prepare('SELECT created_at FROM pending_signups WHERE email = ?');
  $st->execute([$email]);
  $row = $st->fetch();
  if (!$row) return false;
  return (time() - (int) $row['created_at']) < 45;
}

function register_request(string $username, string $email, string $password): array {
  $username = normalize_username($username);
  $email = normalize_email($email);
  $password = (string) $password;

  if (!valid_username($username)) {
    return ['ok' => false, 'error' => 'Username 3–32 ký tự: a-z, 0-9, gạch dưới.'];
  }
  if (!valid_email($email)) {
    return ['ok' => false, 'error' => 'Email không hợp lệ.'];
  }
  if (!valid_password($password)) {
    return ['ok' => false, 'error' => 'Mật khẩu tối thiểu 6 ký tự.'];
  }

  if (member_row_by_username($username)) {
    return ['ok' => false, 'error' => 'Username đã được dùng.'];
  }
  $existing = member_row($email);
  if ($existing && !empty($existing['password_hash'])) {
    return ['ok' => false, 'error' => 'Email đã đăng ký. Hãy đăng nhập.'];
  }
  if ($existing && !empty($existing['username']) && $existing['username'] !== $username) {
    return ['ok' => false, 'error' => 'Email đã gắn với username khác.'];
  }

  // username trùng pending của email khác?
  $st = db()->prepare('SELECT email FROM pending_signups WHERE username = ? AND email != ?');
  $st->execute([$username, $email]);
  if ($st->fetch()) {
    return ['ok' => false, 'error' => 'Username đang chờ xác nhận OTP ở email khác.'];
  }

  if (pending_rate_limited($email)) {
    return ['ok' => false, 'error' => 'Vui lòng đợi khoảng 1 phút trước khi gửi lại mã.'];
  }

  $code = generate_otp_code();
  $ttl = max(3, (int) (cfg('otp_ttl_minutes') ?? 10));
  $now = time();
  $token = bin2hex(random_bytes(24));
  $codeHash = password_hash($code, PASSWORD_DEFAULT);
  $tokenHash = hash('sha256', $token);
  $passHash = password_hash($password, PASSWORD_DEFAULT);

  if (db_is_mysql()) {
    db()->prepare(
      'INSERT INTO pending_signups
        (email, username, password_hash, code_hash, token_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         password_hash = VALUES(password_hash),
         code_hash = VALUES(code_hash),
         token_hash = VALUES(token_hash),
         expires_at = VALUES(expires_at),
         attempts = 0,
         created_at = VALUES(created_at)'
    )->execute([$email, $username, $passHash, $codeHash, $tokenHash, $now + ($ttl * 60), $now]);
  } else {
    db()->prepare(
      'INSERT INTO pending_signups
        (email, username, password_hash, code_hash, token_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(email) DO UPDATE SET
         username = excluded.username,
         password_hash = excluded.password_hash,
         code_hash = excluded.code_hash,
         token_hash = excluded.token_hash,
         expires_at = excluded.expires_at,
         attempts = 0,
         created_at = excluded.created_at'
    )->execute([$email, $username, $passHash, $codeHash, $tokenHash, $now + ($ttl * 60), $now]);
  }

  $base = rtrim((string) cfg('base_url', ''), '/');
  $link = $base !== ''
    ? $base . '/dang-ky/?email=' . rawurlencode($email) . '&token=' . rawurlencode($token)
    : '';

  $sent = send_otp_mail($email, $code, $link);
  if (empty($sent['ok'])) {
    return ['ok' => false, 'error' => $sent['error'] ?? 'Không gửi được email OTP.'];
  }

  return [
    'ok' => true,
    'email' => $email,
    'username' => $username,
    'expires_in' => $ttl * 60,
    'message' => 'Đã gửi mã OTP tới email. Nhập mã để hoàn tất đăng ký.',
  ];
}

function register_verify(string $email, string $code = '', string $token = ''): array {
  $email = normalize_email($email);
  if (!valid_email($email)) {
    return ['ok' => false, 'error' => 'Email không hợp lệ.'];
  }

  $st = db()->prepare('SELECT * FROM pending_signups WHERE email = ?');
  $st->execute([$email]);
  $row = $st->fetch();
  if (!$row) {
    return ['ok' => false, 'error' => 'Chưa có đăng ký chờ xác nhận. Hãy gửi lại OTP.'];
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
    db()->prepare('UPDATE pending_signups SET attempts = attempts + 1 WHERE email = ?')->execute([$email]);
    return ['ok' => false, 'error' => 'Mã xác nhận không đúng.'];
  }

  $username = normalize_username((string) $row['username']);
  if (!valid_username($username)) {
    return ['ok' => false, 'error' => 'Username không hợp lệ.'];
  }
  if (member_row_by_username($username) && (!member_row($email) || (member_row($email)['username'] ?? '') !== $username)) {
    return ['ok' => false, 'error' => 'Username đã được dùng.'];
  }

  $now = time();
  $existing = member_row($email);
  if ($existing) {
    db()->prepare(
      'UPDATE members SET username = ?, password_hash = ?, email_verified = 1, updated_at = ? WHERE email = ?'
    )->execute([$username, $row['password_hash'], $now, $email]);
  } else {
    db()->prepare(
      'INSERT INTO members (email, username, password_hash, email_verified, plan, expires_at, note, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, 0, ?, ?, ?)'
    )->execute([$email, $username, $row['password_hash'], '', 'Chưa cấp gói', $now, $now]);
  }

  db()->prepare('DELETE FROM pending_signups WHERE email = ?')->execute([$email]);
  $member = member_row($email);
  login_member($member ?: ['email' => $email, 'username' => $username]);

  return [
    'ok' => true,
    'email' => $email,
    'username' => $username,
    'member' => current_member(),
    'message' => 'Đăng ký thành công. Tài khoản miễn phí — chờ admin cấp gói theo username.',
  ];
}

function login_with_password(string $username, string $password): array {
  $username = normalize_username($username);
  if (!valid_username($username)) {
    return ['ok' => false, 'error' => 'Username không hợp lệ.'];
  }
  if ($password === '') {
    return ['ok' => false, 'error' => 'Nhập mật khẩu.'];
  }
  $row = member_row_by_username($username);
  if (!$row || empty($row['password_hash'])) {
    return ['ok' => false, 'error' => 'Sai username hoặc mật khẩu.'];
  }
  if (empty($row['email_verified'])) {
    return ['ok' => false, 'error' => 'Email chưa xác nhận OTP. Hãy hoàn tất đăng ký.'];
  }
  if (!password_verify($password, (string) $row['password_hash'])) {
    return ['ok' => false, 'error' => 'Sai username hoặc mật khẩu.'];
  }
  login_member($row);
  return [
    'ok' => true,
    'username' => $username,
    'email' => $row['email'],
    'member' => current_member(),
  ];
}

/** @deprecated Giữ tương thích: đăng ký cũ chỉ email OTP → chuyển hướng message */
function create_and_send_otp(string $email): array {
  return [
    'ok' => false,
    'error' => 'Vui lòng đăng ký bằng username + email + mật khẩu tại /dang-ky/ (xác nhận OTP).',
  ];
}

function verify_otp(string $email, string $code = '', string $token = ''): array {
  return register_verify($email, $code, $token);
}

function grant_member(string $username, string $planId, ?int $days = null, string $note = ''): array {
  $username = normalize_username($username);
  if (!valid_username($username)) {
    return ['ok' => false, 'error' => 'Username không hợp lệ.'];
  }
  $row = member_row_by_username($username);
  if (!$row) {
    return ['ok' => false, 'error' => 'Chưa có tài khoản đăng ký với username này. Khách cần đăng ký trước.'];
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
  $base = $now;
  if ((int) $row['expires_at'] > $now) {
    $base = (int) $row['expires_at'];
  }
  $expires = $base + ($useDays * 86400);
  if ($planId === 'lifetime') {
    $expires = $now + (36500 * 86400);
  }

  db()->prepare(
    'UPDATE members SET plan = ?, expires_at = ?, note = ?, updated_at = ? WHERE username = ?'
  )->execute([$planId, $expires, $note, $now, $username]);

  return ['ok' => true, 'member' => member_public(member_row_by_username($username))];
}

function revoke_member(string $username): array {
  $username = normalize_username($username);
  $st = db()->prepare('UPDATE members SET expires_at = 0, updated_at = ? WHERE username = ?');
  $st->execute([time(), $username]);
  return ['ok' => true, 'member' => member_public(member_row_by_username($username))];
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
      'error' => 'Bạn đã dùng hết lượt dùng thử trên trình duyệt này. Hãy đăng nhập thành viên để tiếp tục.',
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
  $username = current_username();
  $bk = $browserKey ?: browser_key_from_request();
  $trial = trial_status($bk);
  $allowPdf = !empty(cfg('trial_allow_pdf'));

  if ($member && !empty($member['active'])) {
    return [
      'allowed' => true,
      'mode' => 'member',
      'can_pdf' => true,
      'email' => $email,
      'username' => $username,
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
      'username' => $username,
      'member' => $member,
      'trial' => $trial,
    ];
  }
  return [
    'allowed' => false,
    'mode' => !empty($trial['used_up']) ? 'trial_used' : 'locked',
    'can_pdf' => false,
    'email' => $email,
    'username' => $username,
    'member' => $member,
    'trial' => $trial,
  ];
}

function require_admin(): void {
  if (empty($_SESSION['admin'])) {
    json_out(['ok' => false, 'error' => 'Cần đăng nhập admin.'], 401);
  }
}
