<?php
declare(strict_types=1);

function db_driver(): string {
  $d = strtolower((string) (cfg('db_driver') ?? 'auto'));
  if ($d === 'mysql' || $d === 'sqlite') return $d;

  $hasSqlite = class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers(), true);
  $hasMysql = class_exists('PDO') && in_array('mysql', PDO::getAvailableDrivers(), true);
  $mysql = cfg('mysql', []);
  $mysqlReady = is_array($mysql)
    && !empty($mysql['dbname'])
    && !empty($mysql['user'])
    && $mysql['dbname'] !== 'TEN_DATABASE'
    && $mysql['user'] !== 'TEN_USER_MYSQL';

  // auto: sqlite nếu có; không thì mysql (phổ biến trên hosting cPanel)
  if ($hasSqlite) return 'sqlite';
  if ($hasMysql) return 'mysql';
  return $mysqlReady ? 'mysql' : 'sqlite';
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
  username TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email_verified INTEGER NOT NULL DEFAULT 0,
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
CREATE TABLE IF NOT EXISTS pending_signups (
  email TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  code_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL DEFAULT '',
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  email TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
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
  db_ensure_member_auth_columns_sqlite($pdo);
  $cols = $pdo->query('PRAGMA table_info(otps)')->fetchAll();
  $names = array_map(static function ($c) {
    return $c['name'];
  }, $cols);
  if (!in_array('token_hash', $names, true)) {
    $pdo->exec("ALTER TABLE otps ADD COLUMN token_hash TEXT NOT NULL DEFAULT ''");
  }
  $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_members_username ON members(username) WHERE username != ""');
}

function db_ensure_member_auth_columns_sqlite(PDO $pdo): void {
  $cols = $pdo->query('PRAGMA table_info(members)')->fetchAll();
  $names = array_map(static function ($c) {
    return $c['name'];
  }, $cols);
  if (!in_array('username', $names, true)) {
    $pdo->exec("ALTER TABLE members ADD COLUMN username TEXT NOT NULL DEFAULT ''");
  }
  if (!in_array('password_hash', $names, true)) {
    $pdo->exec("ALTER TABLE members ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''");
  }
  if (!in_array('email_verified', $names, true)) {
    $pdo->exec('ALTER TABLE members ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
  }
  if (!in_array('phone', $names, true)) {
    $pdo->exec("ALTER TABLE members ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  }
  if (!in_array('full_name', $names, true)) {
    $pdo->exec("ALTER TABLE members ADD COLUMN full_name TEXT NOT NULL DEFAULT ''");
  }
  $pcols = $pdo->query('PRAGMA table_info(pending_signups)')->fetchAll();
  $pnames = array_map(static function ($c) {
    return $c['name'];
  }, $pcols);
  if ($pnames && !in_array('phone', $pnames, true)) {
    $pdo->exec("ALTER TABLE pending_signups ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  }
  if ($pnames && !in_array('full_name', $pnames, true)) {
    $pdo->exec("ALTER TABLE pending_signups ADD COLUMN full_name TEXT NOT NULL DEFAULT ''");
  }
}

function db_mysql_has_column(PDO $pdo, string $table, string $column): bool {
  $st = $pdo->prepare(
    'SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
  );
  $st->execute([$table, $column]);
  $row = $st->fetch();
  return ((int) ($row['c'] ?? 0)) > 0;
}

function db_migrate_mysql(PDO $pdo): void {
  $pdo->exec(<<<SQL
CREATE TABLE IF NOT EXISTS members (
  email VARCHAR(191) NOT NULL PRIMARY KEY,
  username VARCHAR(64) NULL DEFAULT NULL,
  full_name VARCHAR(120) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(32) NOT NULL DEFAULT '',
  email_verified TINYINT NOT NULL DEFAULT 0,
  plan VARCHAR(64) NOT NULL DEFAULT '',
  expires_at INT NOT NULL,
  note TEXT NOT NULL,
  created_at INT NOT NULL,
  updated_at INT NOT NULL,
  UNIQUE KEY idx_members_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS otps (
  email VARCHAR(191) NOT NULL PRIMARY KEY,
  code_hash VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL DEFAULT '',
  expires_at INT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS pending_signups (
  email VARCHAR(191) NOT NULL PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  full_name VARCHAR(120) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL DEFAULT '',
  code_hash VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL DEFAULT '',
  expires_at INT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS password_resets (
  email VARCHAR(191) NOT NULL PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL,
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
  if (!db_mysql_has_column($pdo, 'members', 'username')) {
    $pdo->exec('ALTER TABLE members ADD COLUMN username VARCHAR(64) NULL DEFAULT NULL');
    try {
      $pdo->exec('ALTER TABLE members ADD UNIQUE KEY idx_members_username (username)');
    } catch (Throwable $e) {
      // index may already exist
    }
  }
  if (!db_mysql_has_column($pdo, 'members', 'password_hash')) {
    $pdo->exec("ALTER TABLE members ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT ''");
  }
  if (!db_mysql_has_column($pdo, 'members', 'email_verified')) {
    $pdo->exec('ALTER TABLE members ADD COLUMN email_verified TINYINT NOT NULL DEFAULT 0');
  }
  if (!db_mysql_has_column($pdo, 'members', 'phone')) {
    $pdo->exec("ALTER TABLE members ADD COLUMN phone VARCHAR(32) NOT NULL DEFAULT ''");
  }
  if (!db_mysql_has_column($pdo, 'members', 'full_name')) {
    $pdo->exec("ALTER TABLE members ADD COLUMN full_name VARCHAR(120) NOT NULL DEFAULT ''");
  }
  if (!db_mysql_has_column($pdo, 'pending_signups', 'phone')) {
    try {
      $pdo->exec("ALTER TABLE pending_signups ADD COLUMN phone VARCHAR(32) NOT NULL DEFAULT ''");
    } catch (Throwable $e) {
      // ignore
    }
  }
  if (!db_mysql_has_column($pdo, 'pending_signups', 'full_name')) {
    try {
      $pdo->exec("ALTER TABLE pending_signups ADD COLUMN full_name VARCHAR(120) NOT NULL DEFAULT ''");
    } catch (Throwable $e) {
      // ignore
    }
  }
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
