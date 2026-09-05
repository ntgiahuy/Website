# Thành viên trả phí theo thời gian — hướng dẫn

Một mã thành viên (`GH1....`) mở khóa **Xuất PDF / CAD** trên cả 3 tiện ích trong thời hạn còn hiệu lực:

| Tiện ích | URL |
|----------|-----|
| Cột | https://cot.giahuy.net/ |
| Móng | https://mong.giahuy.net/ |
| Dầm | https://dam.giahuy.net/ |

CDN (repo này): https://xd.giahuy.net/thanh-vien/

**Trang chủ dùng cả 3 tiện ích:** https://xd.giahuy.net/hub/  
Dùng thử 10 phút / 1 lần → hết giờ chọn gói 3 tháng · 6 tháng · 1 năm · 2 năm · 3 năm · 5 năm · vĩnh viễn.

> **Repo đang Public?** Đọc [BAO-MAT.md](./BAO-MAT.md) — phải đổi `cot` / `mong` / `dam` sang **Private**, rồi gắn khóa Xuất PDF. Chỉ để Public thì người khác tải mã và bỏ khóa được.

## Luồng hoạt động

1. Khách chọn gói → chuyển khoản (STK trong `pay-config.json`).
2. Bạn mở https://xd.giahuy.net/thanh-vien/admin.html → import **private JWK** → tạo mã có hạn.
3. Khách dán mã tại https://xd.giahuy.net/thanh-vien/#kich-hoat (hoặc trong app sau khi tích hợp).
4. App gọi `GiaHuyMembership.requireActive()` trước khi xuất PDF.

Mã được ký ECDSA P-256; app xác minh bằng `public-jwk.json` (công khai). **Private key không được commit lên GitHub.**

## Tích hợp vào từng app (cần quyền push repo cot / mong / dam)

Agent hiện chỉ push được repo `Website`. Với mỗi app, thêm 2 chỗ:

### 1. Nạp script (HTML root)

```html
<script src="https://xd.giahuy.net/js/membership.js"></script>
```

Có Worker (tuỳ chọn, chắc hơn):

```html
<script
  src="https://xd.giahuy.net/js/membership.js"
  data-verify-url="https://giahuy-license-verify.xxx.workers.dev/verify"
></script>
```

- **cot** / **mong**: `index.html` (Vite)
- **dam**: `app/layout.tsx` (Next) — dùng `next/script`

### 2. Chặn nút Xuất PDF

```ts
async function onExportPdf() {
  const ok = await window.GiaHuyMembership.requireActive({
    feature: "Xuất PDF",
    app: "cot", // hoặc "mong" | "dam"
  });
  if (!ok) return;
  // ... logic xuất PDF hiện có
}
```

Với **mong**, bọc cả `Tải file PDF` và `Tải file CAD (DXF)`.

### Gợi ý UI nhỏ trên header app

```ts
const st = await GiaHuyMembership.getStatus();
// hiển thị: st.active ? GiaHuyMembership.formatExpiry(st) : "Chưa thành viên"
```

## Cấu hình thanh toán

Sửa `thanh-vien/pay-config.json` rồi commit/push:

```json
{
  "bank": "Sacombank",
  "account": "0362118138",
  "holder": "NGUYEN THANH NHAT",
  "note": "Nội dung CK: GH TV + gói + email",
  "email": "nhatxd@icloud.com",
  "zalo": ""
}
```

## Bảo mật

Chi tiết đầy đủ: **[BAO-MAT.md](./BAO-MAT.md)** và Worker mẫu `workers/license-verify/`.

## Kiểm tra nhanh

```bash
# phục vụ CDN local
npx --yes serve -l 4177 /path/to/Website
# mở http://127.0.0.1:4177/thanh-vien/admin.html
```
