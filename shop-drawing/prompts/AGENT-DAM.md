# Tin nhắn dán vào agent Shop drawing dầm

Copy toàn bộ khối dưới đây gửi cho agent repo `dam`:

---

App dầm **upload tĩnh** vào hosting:

```
public_html/shop-drawing/dam/app/
  index.html
  (toàn bộ assets build)
```

## Không làm trong app dầm

- Không tự kiểm tra / lưu danh sách tên miền đối tác. Tab **Đối tác** do hosting: `https://YOUR-DOMAIN.com/shop-drawing/admin/` → tab Đối tác. Cổng `shop-drawing/dam/index.php` đã khóa iframe.
- Không tự làm trang đăng ký / đăng nhập / OTP / mật khẩu trong app dầm.
- Đối tác nhúng cổng (không nhúng `.../dam/app/`):

```html
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/dam/" width="100%" height="980" style="border:0" allow="download"></iframe>
```

## Auth hosting (đã đổi — cần khớp)

- Đăng ký (hub): username + email + mật khẩu → OTP **chỉ lần đăng ký đầu** (xác nhận email).
- Đăng nhập (hub): **username + mật khẩu**.
- Admin cấp gói theo **username**.

Khóa Xuất PDF bằng JS hosting:

```html
<script src="/shop-drawing/assets/membership.js"
        data-api="/shop-drawing/api/"
        data-activate-url="/shop-drawing/dang-nhap/"></script>
```

```js
const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF", app: "dam" });
if (!ok) return;
```

Nếu bị khóa: mở `/shop-drawing/dang-nhap/`, không dùng email OTP / `requestOtp`.

## Build

Build tĩnh → upload `shop-drawing/dam/app/`; base `/shop-drawing/dam/app/` hoặc `./`. Không publish github.io nếu khóa theo tab Đối tác.
