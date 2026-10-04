<?php
declare(strict_types=1);

function db(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;

  if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    throw new RuntimeException('Hosting thiếu PDO SQLite. Trong cPanel → Select PHP Version → bật pdo_sqlite + sqlite.');
  }

  $path = (string) cfg('db_path');
  $dir = dirname($path);
  if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
  }
  if (!is_writable($dir)) {
    throw new RuntimeException('Thư mục data/ không ghi được. Chmod 755 hoặc 775 cho shop-drawing/data/.');
  }

  $pdo = new PDO('sqlite:' . $path, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  $pdo->exec('PRAGMA foreign_keys = ON');

  $pdo->exec(<<<SQL
CREATE TABLE IF NOT EXISTS members (
  email TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT '',
  expires_at INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS otps (
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL DEFAULT '',
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (email)
);
CREATE TABLE IF NOT EXISTS trials (
  browser_key TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS allowed_domains (
  domain TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
SQL);

  // Migration nhẹ nếu DB cũ thiếu cột token_hash
  $cols = $pdo->query("PRAGMA table_info(otps)")->fetchAll();
  $names = array_map(static function ($c) {
    return $c['name'];
  }, $cols);
  if (!in_array('token_hash', $names, true)) {
    $pdo->exec("ALTER TABLE otps ADD COLUMN token_hash TEXT NOT NULL DEFAULT ''");
  }

  return $pdo;
}

function setting_get(string $key, ?string $default = null): ?string {
  $st = db()->prepare('SELECT value FROM settings WHERE key = ?');
  $st->execute([$key]);
  $row = $st->fetch();
  if (!$row) return $default;
  return (string) $row['value'];
}

function setting_set(string $key, string $value): void {
  db()->prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )->execute([$key, $value]);
}
