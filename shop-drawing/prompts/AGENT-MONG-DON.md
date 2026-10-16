# Tin nhắn dán vào agent Shop drawing móng đơn

Copy toàn bộ khối dưới đây gửi cho agent repo `mong`:

---

App móng đơn **upload tĩnh** vào hosting:

```
public_html/shop-drawing/mong/app/
  index.html
  (toàn bộ assets build)
```

## Không làm trong app móng

- Không tự kiểm tra / lưu danh sách tên miền đối tác. Tab **Đối tác** do hosting: `https://YOUR-DOMAIN.com/shop-drawing/admin/` → tab Đối tác. Cổng `shop-drawing/mong/index.php` đã khóa iframe.
- Không tự làm trang đăng ký / đăng nhập / OTP / mật khẩu trong app móng. Auth nằm ở hub hosting.
- Không nhúng thẳng `.../mong/app/`. Đối tác nhúng cổng:

```html
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/mong/" width="100%" height="980" style="border:0" allow="download"></iframe>
```

## Auth hosting (đã đổi — cần khớp)

Thành viên **không còn đăng nhập bằng email OTP**.

- Đăng ký (hub): username + email + mật khẩu → **OTP chỉ khi đăng ký lần đầu** để xác nhận email.
- Đăng nhập (hub): **username + mật khẩu**.
- Admin cấp gói theo **username**.

Khóa **Xuất PDF / DXF** (và tính năng trả phí) bằng file hosting, không copy JS cũ:

```html
<script src="/shop-drawing/assets/membership.js"
        data-api="/shop-drawing/api/"
        data-activate-url="/shop-drawing/dang-nhap/"></script>
```

```js
const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF", app: "mong" });
if (!ok) return;
// Xuất PDF / DXF
```

Nếu popup khóa: mở `/shop-drawing/dang-nhap/` (username + mật khẩu), **không** mở form email OTP, **không** dùng `requestOtp` / `verifyOtp`.

## Build

1. Build tĩnh (Vite/… → `dist`).
2. Deploy vào `shop-drawing/mong/app/` (`index.html` ở gốc thư mục đó).
3. Base path: `/shop-drawing/mong/app/` hoặc `./`.
4. Không publish đối tác bằng github.io nếu muốn khóa theo tab Đối tác.
