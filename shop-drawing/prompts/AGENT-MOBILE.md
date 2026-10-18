# Lệnh / tin nhắn dán agent — fix mobile (không sửa home hub)

**Home shop drawing (`Website/shop-drawing`) giữ nguyên** — không thêm `mobile-fit.css` ở hub.  
Sửa CSS / class layout **trong từng repo agent**, rồi build → upload vào `shop-drawing/{mong|cot|dam|san}/app/`.

---

## Vì sao tràn trên điện thoại

App nằm trong iframe hub (dưới header). Dùng `h-dvh` / `100vh` / `min-height: 100vh` = cao bằng cả màn hình máy → **cao hơn khung iframe** → tràn. Toolbar / form sát mép cũng làm cảm giác “không canh vừa”.

---

## Cách dùng

1. Mở Cursor agent đúng repo: `ntgiahuy/mong` · `ntgiahuy/cot` · `ntgiahuy/dam` · `ntgiahuy/san`
2. Copy **một khối** tương ứng bên dưới → gửi agent
3. Agent sửa source → build → bạn upload `dist`/`docs` vào hub `shop-drawing/<app>/app/`

Hoặc chạy script patch local (sau khi clone 4 repo cạnh nhau):

```bash
# Từ thư mục chứa mong/ cot/ dam/ san/
curl -fsSL https://raw.githubusercontent.com/ntgiahuy/Website/cursor/shop-drawing-email-otp-4719/shop-drawing/prompts/patch-agent-mobile.sh -o patch-agent-mobile.sh
# hoặc copy file shop-drawing/prompts/patch-agent-mobile.sh từ repo Website
chmod +x patch-agent-mobile.sh
./patch-agent-mobile.sh /path/to/parent   # parent chứa mong cot dam san
```

---

## Tin nhắn dán — MÓNG (`ntgiahuy/mong`)

```
Fix layout mobile khi app chạy trong iframe hub shop-drawing (dưới header). Không thêm file mobile-fit.css riêng; sửa CSS/source gốc.

Yêu cầu:
1) html, body, #root, .app: height 100%; max-width 100%; overflow-x hidden; box-sizing border-box.
2) Không dùng min-height: 100vh / 100dvh cho shell chính khi có thể — dùng height: 100% để vừa iframe.
3) .topbar / .workspace / .form-cols: min-width 0; max-width 100%.
4) Nút toolbar wrap (flex-wrap) trên max-width 760px; tab/mode-switch overflow-x auto trong chính nó, không làm rộng trang.
5) Form trên mobile: thêm padding ngang ~0.5–0.75rem; tránh đẩy unit "mm" sát mép phải.
6) .shop-sheet / bản vẽ rộng: cuộn trong .shop-scroll, không làm document.scrollWidth > clientWidth.
7) Quy tắc @media print giữ nguyên (overflow visible khi in); chỉ sửa @media screen / mặc định.
8) Build lại và xác nhận trên viewport ~390×844: document.documentElement.scrollWidth === clientWidth.

Không đụng auth/membership.js hub. Base path vẫn ./ hoặc /shop-drawing/mong/app/.
```

---

## Tin nhắn dán — CỘT (`ntgiahuy/cot`)

```
Fix layout mobile khi app chạy trong iframe hub shop-drawing. Không thêm mobile-fit.css; sửa App.css / index.css / App.tsx.

Yêu cầu:
1) html, body, #root: height 100%; max-width 100%; overflow-x hidden.
2) .app-root: đổi min-height: 100vh → height: 100%; max-height: 100%; max-width: 100%; overflow: hidden (hoặc overflow-x hidden + overflow-y auto chỉ trong vùng nội dung).
3) .site-header: flex-wrap; logo max-height ~2rem trên max-width 760px; brand-copy min-width 0.
4) .app-shell / .sidebar / .workspace / .elevation-board: min-width 0; max-width 100%.
5) .elevation-board và bảng ngang: overflow-x auto trong pane, không tràn document.
6) Modal: max-height dùng 100svh / calc(100% - 24px) ổn; không làm body rộng hơn viewport.
7) Font url dùng path tương đối ./fonts/... (không hardcode /cot/fonts/ nếu base path hub là /shop-drawing/cot/app/).
8) Viewport ~390×844: scrollWidth === clientWidth.

Không đụng auth hub. Build → upload shop-drawing/cot/app/.
```

---

## Tin nhắn dán — DẦM (`ntgiahuy/dam`)

```
Fix layout mobile trong iframe hub. Không thêm mobile-fit.css; sửa class Tailwind / CSS gốc.

File chính thường là components/beam/BeamApp.tsx (shell `flex h-dvh flex-col`).

Yêu cầu:
1) Đổi shell `h-dvh` → `h-full` (hoặc `h-[100%]`). Thêm vào globals/layout: html, body, #root { height: 100%; max-width: 100%; overflow: hidden; }.
2) Header nút: đã flex-wrap thì giữ; trên ≤760px căn trái, gap nhỏ hơn, logo max-h-8.
3) Nav tab: giữ overflow-x-auto; đảm bảo parent max-w-full min-w-0, không đẩy rộng trang.
4) Lưới form: trên mobile stack 1 cột nếu đang 2 cột quá chật; input/label min-w-0; padding ngang đủ.
5) Pane bản vẽ: min-w-0; overflow auto trong pane.
6) Không dùng w-screen / 100vw cho shell.
7) Kiểm tra 390×844: documentElement.scrollWidth === clientWidth; chiều cao app ≈ chiều cao iframe (không = 100dvh máy).

Không đụng membership hub. Build static → upload shop-drawing/dam/app/ với path tương đối ./ (không /dam/ tuyệt đối nếu deploy dưới hub).
```

---

## Tin nhắn dán — SÀN (`ntgiahuy/san`)

```
Fix layout mobile trong iframe hub. Không thêm mobile-fit.css; sửa class Tailwind / CSS gốc.

File chính thường là components/slab/SlabApp.tsx (shell `flex h-dvh flex-col`).

Yêu cầu:
1) Đổi shell `h-dvh` → `h-full`. html, body, #root { height: 100%; max-width: 100%; overflow: hidden; }.
2) Header: wrap nút; logo nhỏ hơn trên mobile; title/subtitle min-w-0.
3) Nav tab overflow-x-auto trong nav; parent min-w-0 max-w-full.
4) Form label+input (grid cols label|input): trên ≤760px stack 1 cột, input width 100%.
5) Các hàng flex-nowrap (trục/dầm): cho phép flex-wrap trên mobile.
6) Preview/canvas: min-w-0; overflow auto trong pane, không tràn trang.
7) 390×844: scrollWidth === clientWidth; app height = 100% iframe, không 100dvh.

Không đụng membership hub. Build → upload shop-drawing/san/app/.
```

---

## Checklist sau khi agent xong

| Repo | Upload vào |
|------|------------|
| mong | `shop-drawing/mong/app/` |
| cot  | `shop-drawing/cot/app/` |
| dam  | `shop-drawing/dam/app/` |
| san  | `shop-drawing/san/app/` |

Hub `shop-drawing/index.html` / auth / `membership.js` **không** cần đổi vì việc này.
