# Tin nhắn dán vào agent Shop drawing sàn

Copy toàn bộ khối dưới đây gửi cho agent repo `san`:

---

App sàn **upload tĩnh** vào hosting:

```
public_html/shop-drawing/san/app/
  index.html
  (toàn bộ assets build)
```

## Không làm trong app sàn

- Không tự kiểm tra / lưu danh sách tên miền đối tác. Tab **Đối tác** do hosting: `https://YOUR-DOMAIN.com/shop-drawing/admin/` → tab Đối tác. Cổng `shop-drawing/san/index.php` đã khóa iframe.
- Không tự làm trang đăng ký / đăng nhập / OTP / mật khẩu trong app sàn. Auth nằm ở hub hosting.
- Không nhúng thẳng `.../san/app/`. Đối tác nhúng cổng:

```html
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/san/" width="100%" height="980" style="border:0" allow="download"></iframe>
```

## Auth hosting (đã đổi — cần khớp)

Thành viên **không còn đăng nhập bằng email OTP**.

- Đăng ký (hub): username + email + mật khẩu → **OTP chỉ khi đăng ký lần đầu** để xác nhận email.
- Đăng nhập (hub): **username + mật khẩu**.
- Admin cấp gói theo **username**.

Khóa **Xuất PDF** (và tính năng trả phí) bằng file hosting, không copy JS cũ:

```html
<script src="/shop-drawing/assets/membership.js"
        data-api="/shop-drawing/api/"
        data-activate-url="/shop-drawing/dang-nhap/"></script>
```

```js
const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF", app: "san" });
if (!ok) return;
// Xuất PDF
```

Nếu popup khóa: mở `/shop-drawing/dang-nhap/` (username + mật khẩu), **không** mở form email OTP, **không** dùng `requestOtp` / `verifyOtp`.

## Build

1. Build tĩnh (Vite/… → `dist`).
2. Deploy vào `shop-drawing/san/app/` (`index.html` ở gốc thư mục đó).
3. Base path: `/shop-drawing/san/app/` hoặc `./`.
4. Không publish đối tác bằng github.io nếu muốn khóa theo tab Đối tác.
