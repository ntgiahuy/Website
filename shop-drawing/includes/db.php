<?php
declare(strict_types=1);

function db_driver(): string {
  $d = strtolower((string) (cfg('db_driver') ?? 'auto'));
  if ($d === 'mysql' || $d === 'sqlite') return $d;

  // auto: ưu tiên sqlite nếu có; không thì mysql nếu đã cấu hình
  if (class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    return 'sqlite';
  }
  $mysql = cfg('mysql', []);
  if (is_array($mysql) && !empty($mysql['dbname']) && !empty($mysql['user'])) {
    if (class_exists('PDO') && in_array('mysql', PDO::getAvailableDrivers(), true)) {
      return 'mysql';
    }
  }
  return 'sqlite';
}

function db_is_mysql(): bool {
  return db_driver() === 'mysql';
}

function db(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;

  if (!class_exists('PDO')) {
    throw new RuntimeException('Hosting thiếu PDO. Bật PDO trong cPanel → Select PHP Version.');
  }

  $driver = db_driver();
  if ($driver === 'mysql') {
    $pdo = db_connect_mysql();
    db_migrate_mysql($pdo);
  } else {
    $pdo = db_connect_sqlite();
    db_migrate_sqlite($pdo);
  }
  return $pdo;
}

function db_connect_sqlite(): PDO {
  if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    throw new RuntimeException(
      'Hosting thiếu PDO SQLite. Cách 1: cPanel → Select PHP Version → bật pdo_sqlite + sqlite. ' .
      'Cách 2: dùng MySQL — trong config.php đặt db_driver => mysql và điền khối mysql.'
    );
  }
  $path = (string) cfg('db_path', dirname(__DIR__) . '/data/members.sqlite');
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
  return $pdo;
}

function db_connect_mysql(): PDO {
  if (!in_array('mysql', PDO::getAvailableDrivers(), true)) {
    throw new RuntimeException('Hosting thiếu PDO MySQL. Trong cPanel → Select PHP Version → bật pdo_mysql + mysqli.');
  }
  $m = cfg('mysql', []);
  if (!is_array($m)) $m = [];
  $host = (string) ($m['host'] ?? 'localhost');
  $port = (int) ($m['port'] ?? 3306);
  $name = (string) ($m['dbname'] ?? '');
  $user = (string) ($m['user'] ?? '');
  $pass = (string) ($m['pass'] ?? '');
  $charset = (string) ($m['charset'] ?? 'utf8mb4');
  if ($name === '' || $user === '') {
    throw new RuntimeException('Thiếu mysql.dbname / mysql.user trong config.php.');
  }
  $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
  return new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);
}

function db_migrate_sqlite(PDO $pdo): void {
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
  $cols = $pdo->query('PRAGMA table_info(otps)')->fetchAll();
  $names = array_map(static function ($c) {
    return $c['name'];
  }, $cols);
  if (!in_array('token_hash', $names, true)) {
    $pdo->exec("ALTER TABLE otps ADD COLUMN token_hash TEXT NOT NULL DEFAULT ''");
  }
}

function db_migrate_mysql(PDO $pdo): void {
  $pdo->exec(<<<SQL
CREATE TABLE IF NOT EXISTS members (
  email VARCHAR(191) NOT NULL PRIMARY KEY,
  plan VARCHAR(64) NOT NULL DEFAULT '',
  expires_at INT NOT NULL,
  note TEXT NOT NULL,
  created_at INT NOT NULL,
  updated_at INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS otps (
  email VARCHAR(191) NOT NULL PRIMARY KEY,
  code_hash VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL DEFAULT '',
  expires_at INT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS trials (
  browser_key VARCHAR(80) NOT NULL PRIMARY KEY,
  started_at INT NOT NULL,
  ends_at INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS allowed_domains (
  domain VARCHAR(191) NOT NULL PRIMARY KEY,
  note VARCHAR(255) NOT NULL DEFAULT '',
  created_at INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(191) NOT NULL PRIMARY KEY,
  value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SQL);
}

function setting_get(string $key, ?string $default = null): ?string {
  if (db_is_mysql()) {
    $st = db()->prepare('SELECT value FROM settings WHERE `key` = ?');
  } else {
    $st = db()->prepare('SELECT value FROM settings WHERE key = ?');
  }
  $st->execute([$key]);
  $row = $st->fetch();
  if (!$row) return $default;
  return (string) $row['value'];
}

function setting_set(string $key, string $value): void {
  if (db_is_mysql()) {
    db()->prepare(
      'INSERT INTO settings (`key`, value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)'
    )->execute([$key, $value]);
    return;
  }
  db()->prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )->execute([$key, $value]);
}

function db_upsert_otp(string $email, string $codeHash, string $tokenHash, int $expiresAt, int $createdAt): void {
  if (db_is_mysql()) {
    db()->prepare(
      'INSERT INTO otps (email, code_hash, token_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE
         code_hash = VALUES(code_hash),
         token_hash = VALUES(token_hash),
         expires_at = VALUES(expires_at),
         attempts = 0,
         created_at = VALUES(created_at)'
    )->execute([$email, $codeHash, $tokenHash, $expiresAt, $createdAt]);
    return;
  }
  db()->prepare(
    'INSERT INTO otps (email, code_hash, token_hash, expires_at, attempts, created_at)
     VALUES (?, ?, ?, ?, 0, ?)
     ON CONFLICT(email) DO UPDATE SET
       code_hash = excluded.code_hash,
       token_hash = excluded.token_hash,
       expires_at = excluded.expires_at,
       attempts = 0,
       created_at = excluded.created_at'
  )->execute([$email, $codeHash, $tokenHash, $expiresAt, $createdAt]);
}

function db_upsert_domain(string $domain, string $note, int $createdAt): void {
  if (db_is_mysql()) {
    db()->prepare(
      'INSERT INTO allowed_domains (domain, note, created_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE note = VALUES(note)'
    )->execute([$domain, $note, $createdAt]);
    return;
  }
  db()->prepare(
    'INSERT INTO allowed_domains (domain, note, created_at) VALUES (?, ?, ?)
     ON CONFLICT(domain) DO UPDATE SET note = excluded.note'
  )->execute([$domain, $note, $createdAt]);
}
