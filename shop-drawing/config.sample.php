<?php
/**
 * Sao chép file này thành config.php rồi điền thông tin thật.
 * KHÔNG upload config.sample.php với mật khẩu thật — chỉ commit mẫu.
 */
return [
  // URL gốc khi truy cập: https://domain-cua-ban.com/shop-drawing
  'base_url' => 'https://YOUR-DOMAIN.com/shop-drawing',

  // Bảo mật — lần đầu: giahuy / GiahuyAdmin (đổi ngay trong Admin)
  'admin_user' => 'giahuy',
  'admin_pass' => 'GiahuyAdmin',
  'session_name' => 'GHSID',
  'otp_ttl_minutes' => 10,
  'otp_length' => 6,

  // Trang chuyển hướng khi iframe không được phép / mở thẳng URL shop
  'embed_deny_redirect' => 'https://www.giahuy.net/',

  // Dùng thử xem shop (phút). Xuất PDF chỉ khi đã là thành viên.
  'trial_minutes' => 30,
  'trial_allow_pdf' => false,

  // SQLite (mặc định) — thư mục data/ phải ghi được (chmod 755 hoặc 775)
  'db_path' => __DIR__ . '/data/members.sqlite',

  // Gửi mail OTP
  // mode: 'smtp' | 'mail' | 'log' (log = ghi OTP vào data/otp-log.txt để thử, không gửi mail)
  'mail' => [
    'mode' => 'smtp',
    'from_email' => 'noreply@YOUR-DOMAIN.com',
    'from_name' => 'GIAHUY Shop Drawing',
    'smtp' => [
      'host' => 'smtp.YOUR-DOMAIN.com',
      'port' => 587,
      'encryption' => 'tls', // tls | ssl | ''
      'username' => 'noreply@YOUR-DOMAIN.com',
      'password' => 'MAT_KHAU_SMTP',
    ],
  ],

  // Gói thành viên (ngày + giá hiển thị)
  'plans' => [
    ['id' => '3m', 'label' => '3 tháng', 'days' => 90, 'price' => 249000],
    ['id' => '6m', 'label' => '6 tháng', 'days' => 180, 'price' => 449000],
    ['id' => '1y', 'label' => '1 năm', 'days' => 365, 'price' => 799000],
    ['id' => '2y', 'label' => '2 năm', 'days' => 730, 'price' => 1399000],
    ['id' => '3y', 'label' => '3 năm', 'days' => 1095, 'price' => 1899000],
    ['id' => 'lifetime', 'label' => 'Vĩnh viễn', 'days' => 36500, 'price' => 4999000],
  ],

  // Thanh toán công khai
  'pay' => [
    'bank' => 'Ngân hàng BIDV',
    'account' => '0362118138',
    'holder' => 'NGUYEN THANH NHAT',
    'note' => 'Nội dung CK: GH + gói + email',
  ],

  // Shop nằm TRONG hosting: shop-drawing/{mong|cot|dam|san}/app/ (upload build agent vào đó)
  // url mặc định 'app/' = thư mục con cạnh index.php cổng domain
  'apps' => [
    ['id' => 'mong', 'name' => 'Shop drawing móng đơn', 'url' => 'app/', 'blurb' => 'PDF / DXF'],
    ['id' => 'cot', 'name' => 'Shop drawing cột', 'url' => 'app/', 'blurb' => 'PDF A1'],
    ['id' => 'dam', 'name' => 'Shop drawing dầm', 'url' => 'app/', 'blurb' => 'PDF A2'],
    ['id' => 'san', 'name' => 'Shop drawing sàn', 'url' => 'app/', 'blurb' => 'Shop drawing sàn'],
    ['id' => 'vach', 'name' => 'Shop drawing vách', 'url' => '', 'blurb' => 'Sắp ra mắt', 'comingSoon' => true],
  ],
];
