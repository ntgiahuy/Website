# Tin nhắn dán vào agent Shop drawing móng đơn

Copy toàn bộ khối dưới đây gửi cho agent repo `mong`:

---

App móng đơn sẽ **upload nằm trong hosting**:

```
public_html/shop-drawing/mong/app/
  index.html
  (toàn bộ assets build)
```

Không tự kiểm tra / lưu danh sách tên miền đối tác.

Domain đối tác do hosting quản lý:
`https://YOUR-DOMAIN.com/shop-drawing/admin/` → tab **Đối tác** (ví dụ `domain.com`).

Site đối tác nhúng **cổng** (không nhúng thẳng `/mong/app/`):

```html
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/mong/" width="100%" height="980" style="border:0" allow="download"></iframe>
```

`shop-drawing/mong/index.php` kiểm tra domain rồi mới mở nội dung trong `mong/app/`.

Việc agent cần làm:
1. Build app tĩnh (Vite/… → `dist` hoặc tương đương).
2. Output/deploy path = `shop-drawing/mong/app/` (có `index.html` ở gốc thư mục đó).
3. Base path nếu cần: `/shop-drawing/mong/app/` (hoặc relative `./`) để asset load đúng trên hosting.
4. (Tuỳ chọn) Khóa Xuất PDF bằng membership hosting:

```html
<script src="/shop-drawing/assets/membership.js"
        data-api="/shop-drawing/api/"
        data-activate-url="/shop-drawing/thanh-vien/"></script>
```

```js
const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF", app: "mong" });
if (!ok) return;
```

Không publish đối tác bằng URL github.io nếu muốn khóa theo tab Đối tác.
