# GIAHUY Shop Drawing — hosting PHP (email OTP)

Gói upload vào `public_html/shop-drawing` trên hosting có PHP + SQLite.

## Luồng thành viên

1. Khách nhập **email**
2. Hệ thống gửi **OTP + link** vào mail (SMTP hoặc `mail()`)
3. Khách xác nhận → session đăng nhập
4. Admin cấp **gói + ngày hết hạn** gắn với email (lưu SQLite)
5. Hub cho xem shop khi còn hạn / đang dùng thử; xuất PDF cần thành viên

## Upload

1. Nén / upload cả thư mục `shop-drawing/` vào:
   ```
   public_html/shop-drawing/
   ```
2. Trên hosting, sao chép cấu hình:
   ```
   cp config.sample.php config.php
   ```
3. Sửa `config.php`:
   - `base_url` → `https://domain-cua-ban.com/shop-drawing`
   - `admin_user` / `admin_pass` (đổi mật khẩu mẫu)
   - `mail` → SMTP hosting (khuyến nghị) hoặc `mode => mail`
   - `pay` → BIDV / STK
   - `apps` → URL iframe shop (github.io hoặc domain riêng)
4. Quyền ghi thư mục `data/` (chmod `755` hoặc `775`) để tạo `members.sqlite`
5. Mở thử:
   - Hub: `https://domain/shop-drawing/`
   - Thành viên: `https://domain/shop-drawing/thanh-vien/`
   - Admin: `https://domain/shop-drawing/admin/` (lần đầu: `giahuy` / `GiahuyAdmin` — đổi ngay)  
     · Tab **Thành viên** · Tab **Đối tác**

## Iframe theo tên miền (mong / cot / dam / san)

Chỉ site có tên miền Admin → tab **Đối tác** đã thêm mới nhúng được. Mở thẳng URL hoặc site chưa cấp → chuyển về `https://www.giahuy.net/`.

1. Admin → tab **Đối tác** → thêm `domain.com` (hoặc `www.domain.com`, có/không `https://`)
2. Trên site đối tác dán mã nhúng (cũng hiện sẵn trong tab Đối tác):

```html
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/mong/" width="100%" height="980" style="border:0" allow="download"></iframe>
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/cot/" width="100%" height="980" style="border:0" allow="download"></iframe>
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/dam/" width="100%" height="980" style="border:0" allow="download"></iframe>
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/san/" width="100%" height="980" style="border:0" allow="download"></iframe>
```

- `www` và không `www` = cùng một tên miền  
- Agents móng/cột/dầm/sàn **upload vào** `shop-drawing/{mong|cot|dam|san}/app/` — **không** tự đọc tab Đối tác; xem [DOITAC-AGENTS.md](./DOITAC-AGENTS.md)

## Cấu trúc

```
shop-drawing/
  index.html              # Hub + dùng thử + OTP
  mong|cot|dam|san/
    index.php             # Cổng kiểm tra domain (Đối tác)
    app/                  # ← upload build agent (index.html + assets)
  thanh-vien/
  admin/                  # Tab Thành viên · Tab Đối tác
  api/
  includes/
  assets/membership.js
  data/
  config.sample.php
  prompts/                # Tin nhắn dán vào từng agent
```

## API chính

| Endpoint | Mô tả |
|----------|--------|
| `POST api/auth_request.php` | `{ email }` → gửi OTP + link |
| `POST api/auth_verify.php` | `{ email, code }` hoặc `{ email, token }` |
| `GET  api/auth_me.php` | Session + member hiện tại |
| `POST api/auth_logout.php` | Đăng xuất |
| `POST api/trial_start.php` | Bắt đầu dùng thử (theo browser key) |
| `GET  api/access.php` | `allowed` / `mode` / `can_pdf` |
| `GET  api/public-config.php` | Plans, pay, apps (công khai) |
| `POST api/admin_login.php` | Đăng nhập admin (`giahuy` / `GiahuyAdmin` lần đầu) |
| `POST api/admin_password.php` | Đổi mật khẩu admin |
| `GET/POST api/admin_members.php` | Liệt kê / cấp / thu hồi thành viên |
| `GET/POST api/admin_domains.php` | Allowlist tên miền iframe |

## Khóa PDF trong app shop

Trong app (mong/cot/dam/san) thêm:

```html
<script src="https://YOUR-DOMAIN.com/shop-drawing/assets/membership.js"
        data-api="https://YOUR-DOMAIN.com/shop-drawing/api/"
        data-activate-url="https://YOUR-DOMAIN.com/shop-drawing/thanh-vien/"></script>
```

```js
const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF", app: "cot" });
if (!ok) return;
```

> Lưu ý CORS: nếu shop chạy domain khác, cần cấu hình CORS + cookie `SameSite=None; Secure` (nâng cao). Cách đơn giản: mở shop qua iframe cùng hub trên domain hosting.

## Bảo mật nhanh

- Không commit / không để công khai `config.php`
- `data/.htaccess` chặn truy cập SQLite
- Đổi `admin_pass` ngay sau khi upload
- OTP hết hạn theo `otp_ttl_minutes` (mặc định 10 phút)
