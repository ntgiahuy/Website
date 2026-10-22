# Lệnh dán agent — fix tràn điện thoại (Safari)

**Không sửa hub** (`Website/shop-drawing/index.html`).  
**Không thêm** `mobile-fit.css`.  
Sửa **source trong từng repo** → build → upload vào `shop-drawing/{mong|cot|dam|san}/app/`.

App chạy trong **iframe** dưới header hub.  
`h-dvh` / `100vh` / `100dvh` = cao bằng máy → **cao hơn iframe** → Safari tràn (Chrome thường che được).

---

## Cách dùng

1. Mở Cursor agent đúng repo (link bên dưới từng khối).
2. Copy **cả khối** ` ``` ` … ` ``` ` → dán gửi agent.
3. Agent phải: sửa source → build → đưa zip/filebin `dist`/`docs`/`out`.
4. Bạn upload đè vào hub path ghi trong khối.
5. Test **Safari iPhone** (~390×844): không tràn ngang; form nằm gọn trong khung.

---

## Nghiệm thu (agent phải tự chạy trước khi báo xong)

Trong DevTools (iframe app), console phải in `OK`:

```js
(() => {
  const w = document.documentElement;
  const badH = !!document.querySelector('.h-dvh, [class*="h-dvh"]')
    || /min-height:\s*100(vh|dvh)/i.test(document.documentElement.outerHTML);
  const sx = w.scrollWidth > w.clientWidth + 1;
  const root = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  const ok =
    !sx &&
    (root.height === '100%' || root.height.endsWith('px')) &&
    root.overflowX !== 'visible' &&
    body.overflowX !== 'visible';
  console.log({ ok, scrollWidth: w.scrollWidth, clientWidth: w.clientWidth, badH, overflowX: root.overflowX });
  return ok && !sx ? 'OK' : 'FAIL';
})()
```

Shell chính **không** được còn class/`min-height` dùng `100vh` / `100dvh` / `h-dvh`.

---

## 1) MÓNG — dán vào agent repo `ntgiahuy/mong`

Agent: https://github.com/ntgiahuy/mong

```
Bạn đang ở repo ntgiahuy/mong (Vite + React). App được nhúng iframe tại https://giahuy.net/shop-drawing/ (tab Shop thép móng). Trên Safari iPhone UI bị tràn / không canh vừa khung iframe; Chrome thường ổn. ĐÃ thử prompt mềm trước đó — không đủ. Làm đúng từng bước dưới, không thêm mobile-fit.css, không đụng hub Website.

BẮT BUỘC sửa source:

A) src/index.css
- html, body, #root:
  height: 100%; width: 100%; max-width: 100%; margin: 0;
  overflow: hidden; overflow-x: clip; box-sizing: border-box;
  (KHÔNG min-height: 100vh / 100dvh)
- .app: height: 100%; max-height: 100%; max-width: 100%; min-width: 0;
  display: flex; flex-direction: column; overflow: hidden; overflow-x: clip;
- .app-body / vùng form cuộn: flex: 1; min-height: 0; min-width: 0; max-width: 100%;
  overflow-x: clip; overflow-y: auto; -webkit-overflow-scrolling: touch;
- .topbar, .workspace, .form-cols, .form-col, .panel, .field:
  min-width: 0; max-width: 100%; box-sizing: border-box;
- @media (max-width: 760px):
  * padding ngang app/form ~0.7rem (trái+phải), không sát mép
  * .field: flex-wrap: wrap; gap hợp lý
  * .field-controls: max-width: 100%; justify-content: flex-end; flex-wrap: wrap
  * input.num / .unit không đẩy scrollWidth > clientWidth
  * toolbar/mode-switch: wrap hoặc overflow-x: auto TRONG chính nó (không làm tràn body)
- Bản vẽ rộng (.shop-sheet ~1782px): CHỈ cuộn trong .shop-scroll; document/body không tràn ngang
- @media print: giữ overflow visible như cũ — chỉ sửa screen

B) Tìm toàn repo: xóa mọi shell min-height: 100vh / 100dvh / h-dvh / h-screen cho khung chính.

C) Build (npm run build hoặc script docs hiện có). Base path vẫn relative ./ (hub: /shop-drawing/mong/app/).

D) Nghiệm thu viewport 390×844 (Safari hoặc WebKit):
- document.documentElement.scrollWidth === clientWidth
- Không còn h-dvh / 100vh trên shell
- Form “Móng đơn”: label + ô số + “mm” không bị cắt / không tạo thanh cuộn ngang trang

E) Trả về: diff tóm tắt + link zip/filebin thư mục build (docs/ hoặc dist/) để upload đè shop-drawing/mong/app/.
```

Upload hub: `shop-drawing/mong/app/`

---

## 2) CỘT — dán vào agent repo `ntgiahuy/cot`

Agent: https://github.com/ntgiahuy/cot

```
Bạn đang ở repo ntgiahuy/cot (Vite + React). App nhúng iframe hub https://giahuy.net/shop-drawing/ (Shop thép cột). Safari iPhone bị tràn / không khít iframe. Prompt trước chưa đủ — làm đúng checklist. Không mobile-fit.css, không sửa hub Website.

BẮT BUỘC:

A) src/index.css
html, body, #root {
  height: 100%; width: 100%; max-width: 100%; margin: 0;
  overflow: hidden; overflow-x: clip; box-sizing: border-box;
}

B) src/App.css — ĐỔI NGAY:
.app-root {
  /* SAI: min-height: 100vh; overflow-x: hidden; */
  height: 100%;
  max-height: 100%;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  overflow-x: clip;
}
- .app-shell, .sidebar, .workspace, .elevation-board, .site-header, .file-toolbar:
  min-width: 0; max-width: 100%;
- @media (max-width: 900px): stack cột; sidebar/workspace không tạo tràn ngang body
- Bảng / elevation ngang: overflow-x: auto trong pane, không trên body
- .modal: max-width: 100%; max-height: calc(100% - 24px) hoặc 100svh; KHÔNG width: 100vw
- Font: url("./fonts/...") — không "/cot/fonts/" (vỡ khi embed hub)

C) Grep toàn repo: bỏ min-height: 100vh / 100dvh / h-dvh trên shell.

D) Build → output docs/ hoặc dist/ với base ./ 

E) Nghiệm thu 390×844 Safari/WebKit: scrollWidth === clientWidth; shell height 100% iframe.

F) Trả zip/filebin để upload đè shop-drawing/cot/app/.
```

Upload hub: `shop-drawing/cot/app/`

---

## 3) DẦM — dán vào agent repo `ntgiahuy/dam`

Agent: https://github.com/ntgiahuy/dam

```
Bạn đang ở repo ntgiahuy/dam (Next + Tailwind). App nhúng iframe hub https://giahuy.net/shop-drawing/ (Shop thép dầm). Safari iPhone tràn vì shell còn h-dvh. Không mobile-fit.css, không sửa hub Website.

BẮT BUỘC (đúng file):

A) components/beam/BeamApp.tsx
Tìm dòng shell kiểu:
  className="flex h-dvh flex-col ..."
ĐỔI THÀNH:
  className="flex h-full max-h-full min-h-0 w-full max-w-full flex-col overflow-hidden ..."
Grep cả repo: thay mọi h-dvh / h-screen / min-h-screen của shell chính → h-full (kèm min-h-0 max-h-full).

B) app/globals.css
Thêm/sửa:
html, body, #root {
  height: 100%;
  width: 100%;
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  overflow-x: clip;
  box-sizing: border-box;
}
#root, body > div: first layout wrapper: height 100%; min-height 0; max-width 100%.

C) Mobile ≤760px:
- header wrap; logo max-h-8; title min-w-0
- nav: overflow-x-auto; parent min-w-0 max-w-full
- Panel min-w-[280px] / min-w-[320px]: trên mobile đổi min-w-0 w-full (không đẩy ngang)
- Pane bản vẽ: min-w-0; overflow-auto trong pane
- Cấm w-screen / w-[100vw] trên shell

D) Build static đúng script repo (docs/ hoặc out/) basePath relative để chạy tại /shop-drawing/dam/app/.

E) Nghiệm thu 390×844: không còn class h-dvh trong DOM shell; scrollWidth === clientWidth.

F) Trả zip/filebin upload đè shop-drawing/dam/app/.
```

Upload hub: `shop-drawing/dam/app/`

---

## 4) SÀN — dán vào agent repo `ntgiahuy/san`

Agent: https://github.com/ntgiahuy/san

```
Bạn đang ở repo ntgiahuy/san (Next + Tailwind). App nhúng iframe hub https://giahuy.net/shop-drawing/ (Shop thép sàn). Safari iPhone tràn / không khít. Source còn shell h-dvh. Không mobile-fit.css, không sửa hub Website.

BẮT BUỘC:

A) components/slab/SlabApp.tsx
Tìm:
  className="flex h-dvh flex-col ..."
ĐỔI:
  className="flex h-full max-h-full min-h-0 w-full max-w-full flex-col overflow-hidden ..."
Grep: mọi h-dvh / h-screen shell → h-full + min-h-0.

B) app/globals.css
html, body, #root {
  height: 100%;
  width: 100%;
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  overflow-x: clip;
  box-sizing: border-box;
}
Font embed hub: ưu tiên ./fonts/... không hardcode /san/fonts/ nếu làm vỡ path.

C) Mobile ≤760px:
- header wrap; logo nhỏ; title min-w-0
- nav overflow-x-auto; parent min-w-0 max-w-full
- Hàng trục/dầm flex-nowrap → flex-wrap trên mobile; input min-w-0 w-full
- Form label|input stack 1 cột khi hẹp
- Preview pane min-w-0 overflow-auto
- Grid dùng minmax(..., 32vh) cho hàng: đổi sang % hoặc fr dựa trên parent height 100% (tránh 32vh máy > iframe)

D) Build static → docs/out với path ./ cho /shop-drawing/san/app/.

E) Nghiệm thu 390×844 Safari/WebKit: scrollWidth === clientWidth; không h-dvh trên shell.

F) Trả zip/filebin upload đè shop-drawing/san/app/.
```

Upload hub: `shop-drawing/san/app/`

---

## Sau khi 4 agent xong

| Repo | Upload vào hub |
|------|----------------|
| mong | `shop-drawing/mong/app/` |
| cot  | `shop-drawing/cot/app/` |
| dam  | `shop-drawing/dam/app/` |
| san  | `shop-drawing/san/app/` |

Giữ nguyên `config.php`, auth, `membership.js`, `shop-drawing/index.html`.

---

## Script patch local (tuỳ chọn)

Nếu clone 4 repo cạnh nhau:

```bash
curl -fsSL https://raw.githubusercontent.com/ntgiahuy/Website/cursor/shop-drawing-email-otp-4719/shop-drawing/prompts/patch-agent-mobile.sh -o patch-agent-mobile.sh
chmod +x patch-agent-mobile.sh
./patch-agent-mobile.sh /path/to/parent   # chứa mong cot dam san
```

Vẫn nên dùng tin nhắn dán ở trên trong Cursor agent từng repo — script chỉ hỗ trợ CSS thô.
