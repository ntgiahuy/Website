Shop drawing thép sàn — deploy lên giahuy.net (KHÔNG CDN)
=========================================================

Ngày 6/10/2026

Zip CHỈ gồm
-----------
  shop-drawing/san/app/index.html
  shop-drawing/san/app/assets/
  shop-drawing/san/app/fonts/

KHÔNG đóng gói: san/index.php, shop-drawing/app/, membership.js,
shop-drawing/index.html, favicon.

Cài đặt
-------
1. Giải nén zip.
2. Copy nội dung vào:
     public_html/shop-drawing/san/app/
3. KHÔNG ghi đè:
     public_html/shop-drawing/san/index.php   (cổng)
     public_html/shop-drawing/assets/membership.js
     public_html/shop-drawing/app/            (móng)

membership.js (hub — đã có sẵn)
-------------------------------
index.html gọi:
  /shop-drawing/assets/membership.js
  data-api="/shop-drawing/api/"
  data-activate-url="/shop-drawing/dang-nhap/"
KHÔNG copy file này vào san/app/.

Đối tác nhúng CỔNG (không nhúng san/app/):
  <iframe src="https://giahuy.net/shop-drawing/san/"
    width="100%" height="980" style="border:0" allow="download"></iframe>

Admin URL sàn = ./san/

Kiểm tra
--------
  rg -n "fonts.google|gstatic|unpkg|jsdelivr|github.io" dist/   → 0
  rg -n "membership.js" shop-drawing/san/app/index.html
    → chỉ /shop-drawing/assets/membership.js
  Trong zip KHÔNG có file membership.js.
