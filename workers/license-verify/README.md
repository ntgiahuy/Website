# Worker xác minh mã thành viên

## Vì sao cần?

Chỉ khóa trong trình duyệt (`membership.js`) thì người xem DevTools vẫn có thể bỏ qua.
Worker này xác minh mã **trên server** (private key là Cloudflare Secret).

Vẫn chưa khóa cứng 100% nếu PDF còn chạy local — xem [BAO-MAT.md](../../thanh-vien/BAO-MAT.md).

## Deploy

```bash
cd workers/license-verify
npx wrangler login
npx wrangler secret put MEMBERSHIP_PRIVATE_JWK
# dán nguyên file private JWK (một dòng JSON)
npx wrangler deploy
```

Ghi lại URL dạng `https://giahuy-license-verify.<subdomain>.workers.dev`.

## Gắn vào app

```html
<script
  src="https://xd.giahuy.net/js/membership.js"
  data-verify-url="https://giahuy-license-verify.<subdomain>.workers.dev/verify"
></script>
```

Khi có `data-verify-url`, `activate` / `requireActive` sẽ gọi Worker thêm một lần (online).
