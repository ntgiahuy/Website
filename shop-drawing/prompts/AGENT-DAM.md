# Tin nhắn dán vào agent Shop drawing dầm

Copy toàn bộ khối dưới đây gửi cho agent repo `dam`:

---

App dầm sẽ **upload nằm trong hosting**:

```
public_html/shop-drawing/dam/app/
  index.html
  (toàn bộ assets build)
```

Không tự kiểm tra / lưu danh sách tên miền đối tác.

Domain đối tác do hosting quản lý:
`https://YOUR-DOMAIN.com/shop-drawing/admin/` → tab **Đối tác** (ví dụ `domain.com`).

Site đối tác nhúng **cổng**:

```html
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/dam/" width="100%" height="980" style="border:0" allow="download"></iframe>
```

Việc agent cần làm: build tĩnh → upload vào `shop-drawing/dam/app/`; base `/shop-drawing/dam/app/` hoặc `./`.
(Tuỳ chọn) membership.js với `app: "dam"`.
