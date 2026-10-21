# Lệnh / tin nhắn dán agent — fix mobile (không thêm mobile-fit.css ở hub)

Không thêm file `mobile-fit.css` vào home hub.  
Sửa CSS / class layout **trong từng repo agent**, rồi build → upload vào `shop-drawing/{mong|cot|dam|san}/app/`.

Hub đã khóa iframe cho Safari (`overflow-x: clip`, iframe `position: absolute`, `-webkit-fill-available`). App agent vẫn phải dùng `height: 100%` thay vì `100vh`/`h-dvh`.

---

## Vì sao Chrome OK mà Safari tràn

1. App trong iframe hub. `h-dvh` / `100vh` / `min-height: 100vh` = cao bằng màn hình máy → cao hơn khung iframe.
2. **Safari (iOS)** hay **phóng iframe theo chiều cao nội dung** khi parent `height: auto` / `overflow: auto`. Chrome thường vẫn kẹp được → cùng code, Chrome không tràn, Safari tràn.
3. Safari xử lý `overflow-x: hidden` kém hơn `overflow-x: clip` với flex child `min-width: auto`.
4. Thanh địa chỉ Safari làm `100vh`/`100dvh` lệch → thêm lệch dọc.

**Trong agent bắt buộc:**
- Shell: `h-full` / `height: 100%` (không `h-dvh` / `100vh` cho shell chính).
- `html, body, #root { height: 100%; max-width: 100%; overflow: hidden; overflow-x: clip; }`.
- Mọi flex/grid pane: `min-width: 0; max-width: 100%`.
- Không dùng `100vw` cho shell (Safari tính cả scrollbar/safe-area dễ tràn ngang).
- Kiểm tra trên **Safari iOS** (hoặc Safari desktop responsive), không chỉ Chrome.

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

Yêu cầu (ưu tiên Safari iOS — Chrome đã ổn):
1) html, body, #root, .app: height 100%; max-width 100%; overflow: hidden; overflow-x: clip; box-sizing border-box.
2) Không dùng min-height: 100vh / 100dvh / h-dvh cho shell — dùng height: 100%.
3) .topbar / .workspace / .form-cols: min-width 0; max-width 100%.
4) Toolbar flex-wrap ≤760px; tab/mode-switch overflow-x auto trong chính nó.
5) Form mobile: padding ngang ~0.5–0.75rem.
6) .shop-sheet rộng: cuộn trong .shop-scroll; document.scrollWidth === clientWidth.
7) @media print giữ overflow visible; chỉ sửa screen.
8) Không dùng width: 100vw cho shell. Test Safari ~390×844.

Không đụng auth/membership.js hub. Base path vẫn ./ hoặc /shop-drawing/mong/app/.
```

---

## Tin nhắn dán — CỘT (`ntgiahuy/cot`)

```
Fix layout mobile khi app chạy trong iframe hub shop-drawing. Không thêm mobile-fit.css; sửa App.css / index.css / App.tsx.

Yêu cầu (ưu tiên Safari iOS — Chrome đã ổn):
1) html, body, #root: height 100%; max-width 100%; overflow: hidden; overflow-x: clip.
2) .app-root: min-height 100vh → height/max-height 100%; overflow: hidden; overflow-x: clip.
3) .site-header flex-wrap; logo ≤2rem trên mobile; brand-copy min-width 0.
4) .app-shell / .sidebar / .workspace / .elevation-board: min-width 0; max-width 100%.
5) Bảng ngang: overflow-x auto trong pane.
6) Modal: max-height 100svh / calc(100% - 24px); không dùng 100vw.
7) Font url ./fonts/... (không /cot/fonts/).
8) Test Safari ~390×844: scrollWidth === clientWidth.

Không đụng auth hub. Build → upload shop-drawing/cot/app/.
```

---

## Tin nhắn dán — DẦM (`ntgiahuy/dam`)

```
Fix layout mobile trong iframe hub. Không thêm mobile-fit.css; sửa class Tailwind / CSS gốc.

File chính thường là components/beam/BeamApp.tsx (shell `flex h-dvh flex-col`).

Yêu cầu (ưu tiên Safari iOS — Chrome đã ổn):
1) Shell `h-dvh` → `h-full`. globals: html, body, #root { height:100%; max-width:100%; overflow:hidden; overflow-x:clip; }.
2) Header wrap; ≤760px logo max-h-8; gap nhỏ.
3) Nav overflow-x-auto; parent min-w-0 max-w-full.
4) Form mobile stack 1 cột nếu chật; min-w-0.
5) Pane bản vẽ min-w-0; overflow auto trong pane.
6) Không w-screen / 100vw.
7) Test Safari: scrollWidth === clientWidth; app height = 100% iframe (không 100dvh máy).

Không đụng membership hub. Build → upload shop-drawing/dam/app/ (path ./).
```

---

## Tin nhắn dán — SÀN (`ntgiahuy/san`)

```
Fix layout mobile trong iframe hub. Không thêm mobile-fit.css; sửa class Tailwind / CSS gốc.

File chính thường là components/slab/SlabApp.tsx (shell `flex h-dvh flex-col`).

Yêu cầu (ưu tiên Safari iOS — Chrome đã ổn):
1) Shell `h-dvh` → `h-full`. html, body, #root { height:100%; max-width:100%; overflow:hidden; overflow-x:clip; }.
2) Header wrap; logo nhỏ trên mobile; title min-w-0.
3) Nav overflow-x-auto; parent min-w-0 max-w-full.
4) Form label|input ≤760px stack 1 cột, input 100%.
5) flex-nowrap (trục/dầm) → wrap trên mobile.
6) Preview min-w-0; overflow auto trong pane.
7) Test Safari: scrollWidth === clientWidth; height = 100% iframe.

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
