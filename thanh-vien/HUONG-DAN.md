# Thành viên trả phí theo thời gian — hướng dẫn

Một mã thành viên (`GH1....`) mở khóa **Xuất PDF / CAD** trên cả 3 tiện ích trong thời hạn còn hiệu lực:

| Tiện ích | URL |
|----------|-----|
| Cột | https://cot.giahuy.net/ |
| Móng | https://mong.giahuy.net/ |
| Dầm | https://dam.giahuy.net/ |

CDN (repo này): https://cdn.giahuy.net/thanh-vien/

## Luồng hoạt động

1. Khách chọn gói → chuyển khoản (STK trong `pay-config.json`).
2. Bạn mở https://cdn.giahuy.net/thanh-vien/admin.html → import **private JWK** → tạo mã có hạn.
3. Khách dán mã tại https://cdn.giahuy.net/thanh-vien/#kich-hoat (hoặc trong app sau khi tích hợp).
4. App gọi `GiaHuyMembership.requireActive()` trước khi xuất PDF.

Mã được ký ECDSA P-256; app xác minh bằng `public-jwk.json` (công khai). **Private key không được commit lên GitHub.**

## Tích hợp vào từng app (cần quyền push repo cot / mong / dam)

Agent hiện chỉ push được repo `Website`. Với mỗi app, thêm 2 chỗ:

### 1. Nạp script (HTML root)

```html
<script src="https://cdn.giahuy.net/js/membership.js"></script>
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
  "bank": "Vietcombank",
  "account": "0123456789",
  "holder": "NGUYEN NHAT",
  "note": "Nội dung CK: GH TV + gói + email",
  "email": "nhatxd@icloud.com",
  "zalo": ""
}
```

## Bảo mật (thành thật)

- Repo GitHub công khai + app static: người am hiểu vẫn có thể bypass chặn phía client.
- Mã ký số **chống làm giả mã**; không chống crack app.
- Đủ tốt cho bán cho kỹ sư/văn phòng xây dựng. Muốn chắc hơn: thêm server kiểm tra license (Cloudflare Worker / Supabase) và cổng thanh toán tự động (PayOS / SePay).

## Kiểm tra nhanh

```bash
# phục vụ CDN local
npx --yes serve -l 4177 /path/to/Website
# mở http://127.0.0.1:4177/thanh-vien/admin.html
```
