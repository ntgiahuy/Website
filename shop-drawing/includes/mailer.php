<?php
declare(strict_types=1);

function send_otp_mail(string $email, string $code, string $link = ''): array {
  $mailCfg = cfg('mail', []);
  $fromEmail = $mailCfg['from_email'] ?? 'noreply@localhost';
  $fromName = $mailCfg['from_name'] ?? 'GIAHUY';
  $mins = (int) (cfg('otp_ttl_minutes') ?? 10);
  $subject = 'Mã đăng nhập GIAHUY: ' . $code;
  $body = "Xin chào,\n\n"
    . "Mã OTP đăng nhập GIAHUY Shop Drawing của bạn là: {$code}\n"
    . "Mã có hiệu lực trong {$mins} phút.\n";
  if ($link !== '') {
    $body .= "\nHoặc bấm link xác nhận (cùng hiệu lực):\n{$link}\n";
  }
  $body .= "\nNếu bạn không yêu cầu, hãy bỏ qua email này.\n\nGIAHUY";

  $mode = $mailCfg['mode'] ?? 'mail';
  if ($mode === 'log') {
    // Chế độ thử: ghi OTP vào data/otp-log.txt (không gửi mail thật)
    $dir = dirname((string) cfg('db_path'));
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $line = date('c') . "\t" . $email . "\t" . $code . ($link ? "\t" . $link : '') . "\n";
    file_put_contents($dir . '/otp-log.txt', $line, FILE_APPEND);
    return ['ok' => true, 'mode' => 'log'];
  }
  if ($mode === 'smtp') {
    return smtp_send($fromEmail, $fromName, $email, $subject, $body, $mailCfg['smtp'] ?? []);
  }

  $fromHeader = function_exists('mb_encode_mimeheader')
    ? mb_encode_mimeheader($fromName, 'UTF-8')
    : '=?UTF-8?B?' . base64_encode($fromName) . '?=';
  $headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'From: ' . sprintf('%s <%s>', $fromHeader, $fromEmail),
  ];
  $ok = @mail($email, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\r\n", $headers));
  return $ok
    ? ['ok' => true]
    : ['ok' => false, 'error' => 'Hosting từ chối hàm mail(). Hãy cấu hình SMTP trong config.php.'];
}

function smtp_send(string $fromEmail, string $fromName, string $to, string $subject, string $body, array $smtp): array {
  $host = $smtp['host'] ?? '';
  $port = (int) ($smtp['port'] ?? 587);
  $user = $smtp['username'] ?? '';
  $pass = $smtp['password'] ?? '';
  $enc = strtolower((string) ($smtp['encryption'] ?? 'tls'));

  if ($host === '' || $user === '') {
    return ['ok' => false, 'error' => 'Thiếu cấu hình SMTP (host/username).'];
  }

  $remote = ($enc === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
  $fp = @stream_socket_client($remote, $errno, $errstr, 20);
  if (!$fp) {
    return ['ok' => false, 'error' => "Không kết nối SMTP: {$errstr}"];
  }
  stream_set_timeout($fp, 20);

  $read = function () use ($fp): string {
    $data = '';
    while (!feof($fp)) {
      $line = fgets($fp, 515);
      if ($line === false) break;
      $data .= $line;
      if (isset($line[3]) && $line[3] === ' ') break;
    }
    return $data;
  };
  $write = function (string $cmd) use ($fp): void {
    fwrite($fp, $cmd . "\r\n");
  };
  $expect = function (string $prefix, string $step) use ($read): ?string {
    $resp = $read();
    if (strpos($resp, $prefix) !== 0) {
      return "SMTP lỗi ở {$step}: " . trim($resp);
    }
    return null;
  };

  if ($err = $expect('220', 'connect')) { fclose($fp); return ['ok' => false, 'error' => $err]; }
  $write('EHLO shop-drawing.local');
  if ($err = $expect('250', 'EHLO')) { fclose($fp); return ['ok' => false, 'error' => $err]; }

  if ($enc === 'tls') {
    $write('STARTTLS');
    if ($err = $expect('220', 'STARTTLS')) { fclose($fp); return ['ok' => false, 'error' => $err]; }
    if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
      fclose($fp);
      return ['ok' => false, 'error' => 'Không bật được TLS SMTP.'];
    }
    $write('EHLO shop-drawing.local');
    if ($err = $expect('250', 'EHLO2')) { fclose($fp); return ['ok' => false, 'error' => $err]; }
  }

  $write('AUTH LOGIN');
  if ($err = $expect('334', 'AUTH')) { fclose($fp); return ['ok' => false, 'error' => $err]; }
  $write(base64_encode($user));
  if ($err = $expect('334', 'USER')) { fclose($fp); return ['ok' => false, 'error' => $err]; }
  $write(base64_encode($pass));
  if ($err = $expect('235', 'PASS')) { fclose($fp); return ['ok' => false, 'error' => $err]; }

  $write('MAIL FROM:<' . $fromEmail . '>');
  if ($err = $expect('250', 'MAIL')) { fclose($fp); return ['ok' => false, 'error' => $err]; }
  $write('RCPT TO:<' . $to . '>');
  if ($err = $expect('250', 'RCPT')) { fclose($fp); return ['ok' => false, 'error' => $err]; }
  $write('DATA');
  if ($err = $expect('354', 'DATA')) { fclose($fp); return ['ok' => false, 'error' => $err]; }

  $headers = [
    'Date: ' . date('r'),
    'From: ' . sprintf('%s <%s>', $fromName, $fromEmail),
    'To: <' . $to . '>',
    'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
  ];
  $write(implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.");
  if ($err = $expect('250', 'BODY')) { fclose($fp); return ['ok' => false, 'error' => $err]; }
  $write('QUIT');
  fclose($fp);
  return ['ok' => true];
}
