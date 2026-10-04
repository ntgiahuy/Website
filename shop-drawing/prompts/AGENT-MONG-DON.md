# Tin nhắn dán vào agent Shop drawing móng đơn

Copy toàn bộ khối dưới đây gửi cho agent repo `mong`:

---

Không tự kiểm tra / lưu danh sách tên miền đối tác.

Domain đối tác do hosting quản lý ở:
`https://YOUR-DOMAIN.com/shop-drawing/admin/` → tab **Đối tác** (ví dụ thêm `domain.com`).

Site đối tác phải nhúng:

```html
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/mong/" width="100%" height="980" style="border:0" allow="download"></iframe>
```

Cổng PHP `/shop-drawing/mong/` đã chặn domain chưa cấp và chặn mở thẳng URL (chuyển về https://www.giahuy.net/). App móng chỉ là nội dung bên trong iframe sau khi cổng cho phép.

Việc cần làm trong repo móng đơn (nếu chưa có):

1. Giữ app chạy ổn định tại URL mà hosting `config.php` → `apps` id `mong` đang trỏ tới (vd. `https://ntgiahuy.github.io/mong/`).
2. (Tuỳ chọn) Khóa Xuất PDF / CAD bằng thành viên email hosting:

```html
<script src="https://YOUR-DOMAIN.com/shop-drawing/assets/membership.js"
        data-api="https://YOUR-DOMAIN.com/shop-drawing/api/"
        data-activate-url="https://YOUR-DOMAIN.com/shop-drawing/thanh-vien/"></script>
```

```js
const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF", app: "mong" });
if (!ok) return;
```

Không nhúng thẳng `github.io/mong` trên site đối tác nếu muốn khóa theo tab Đối tác.

Thay `YOUR-DOMAIN.com` bằng domain hosting thật.
