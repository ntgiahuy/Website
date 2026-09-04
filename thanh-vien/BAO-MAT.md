# Code Public trên GitHub — làm sao bắt trả phí?

## Kết luận ngắn

| Việc bạn muốn | Public repo + GitHub Pages | Cách làm được |
|---------------|----------------------------|---------------|
| Người thường không dùng được Xuất PDF miễn phí | Được (đủ bán) | Khóa nút bằng mã thành viên |
| Người khác không xem / fork mã nguồn | **Không** nếu để Public | Đổi repo sang **Private** |
| Lập trình viên không bypass được hoàn toàn | **Không** nếu PDF chạy 100% trong trình duyệt | Đưa xuất PDF lên **server** kiểm tra mã |

App đang là **file tĩnh** (HTML/JS) trên `cot.giahuy.net` / `mong` / `dam`. Dù repo Private, trình duyệt vẫn tải JS công khai — người am hiểu có thể mở DevTools và bỏ dòng kiểm tra. Muốn “chắc”, phần xuất PDF phải nằm trên server.

---

## Lớp 1 — Đổi 3 repo sang Private (làm ngay, 2 phút)

Trên GitHub, với từng repo `cot`, `mong`, `dam`:

1. **Settings** → kéo xuống **Danger Zone**
2. **Change repository visibility** → **Private**
3. Giữ nguyên GitHub Pages + domain `*.giahuy.net` (Pages vẫn chạy khi repo Private nếu account đủ điều kiện)

Repo `Website` (CDN) có thể để Public: chỉ chứa trang bán hàng + `membership.js` + khóa **công khai** — không chứa private key.

Sau bước này: không ai clone được mã shop thép từ GitHub nữa.

---

## Lớp 2 — Khóa nút Xuất PDF bằng thành viên (đã dựng trên CDN)

1. Merge PR thành viên trên repo Website → có `xd.giahuy.net/thanh-vien/` + `js/membership.js`
2. Trong mỗi app (repo Private), thêm:

```html
<script src="https://xd.giahuy.net/js/membership.js"></script>
```

```js
const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF", app: "cot" });
if (!ok) return;
```

3. Xem thử / nhập số liệu vẫn mở; **Xuất PDF / CAD** cần mã còn hạn.

Chi tiết: [HUONG-DAN.md](./HUONG-DAN.md)

---

## Lớp 3 — Server kiểm tra mã (chắc hơn)

Thư mục `workers/license-verify/` là Cloudflare Worker mẫu:

- Nhận `POST { license }` → xác minh chữ ký bằng **private key** (Secret trên Cloudflare, không lộ ra GitHub)
- Trả `{ ok, exp, plan }`
- App gọi Worker trước khi xuất PDF (`data-verify-url` trên thẻ script)

Vẫn có thể bypass nếu PDF còn chạy local — nhưng mã giả / mã hết hạn bị chặn ở server, và bạn có thể **thu hồi** mã.

### Chắc nhất (khi sẵn sàng đầu tư thêm)

Đưa **generate PDF** lên Worker/API: client chỉ gửi số liệu + mã; server mới trả file PDF. Khi đó bỏ logic PDF khỏi repo frontend → bypass gần như hết đường.

---

## Việc không nên làm

- Commit **private JWK** lên GitHub (dù Private repo cũng rủi ro)
- Tin rằng chỉ cần “ẩn nút” trên UI là đủ chống fork Public
- Để 3 repo Public sau khi đã bán thành viên — ai cũng tải source và xóa `requireActive`

---

## Checklist thực tế cho GiaHuy

1. [ ] Đổi `cot` / `mong` / `dam` → **Private**
2. [ ] Sửa STK trong `pay-config.json`
3. [ ] Giữ private key chỉ trên máy + Cloudflare Secret
4. [ ] Gắn `membership.js` vào 3 app (cần sửa từng repo)
5. [ ] (Tuỳ chọn) Deploy Worker `license-verify`
6. [ ] (Sau) API xuất PDF phía server nếu cần khóa cứng
