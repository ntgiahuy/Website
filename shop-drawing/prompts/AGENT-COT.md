# Tin nhắn dán vào agent Shop drawing cột

Copy toàn bộ khối dưới đây gửi cho agent repo `cot`:

---

App cột **upload tĩnh** vào hosting:

```
public_html/shop-drawing/cot/app/
  index.html
  (toàn bộ assets build)
```

## Không làm trong app cột

- Không tự kiểm tra / lưu danh sách tên miền đối tác. Tab **Đối tác** do hosting: `https://YOUR-DOMAIN.com/shop-drawing/admin/` → tab Đối tác. Cổng `shop-drawing/cot/index.php` đã khóa iframe.
- Không tự làm trang đăng ký / đăng nhập / OTP / mật khẩu trong app cột.
- Đối tác nhúng cổng (không nhúng `.../cot/app/`):

```html
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/cot/" width="100%" height="980" style="border:0" allow="download"></iframe>
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
const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF", app: "cot" });
if (!ok) return;
```

Nếu bị khóa: mở `/shop-drawing/dang-nhap/`, không dùng email OTP / `requestOtp`.

## Build

Build tĩnh → upload `shop-drawing/cot/app/`; base `/shop-drawing/cot/app/` hoặc `./`. Không publish github.io nếu khóa theo tab Đối tác.
