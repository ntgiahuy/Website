Shop drawing thép sàn — deploy lên giahuy.net (KHÔNG CDN)
=========================================================

Zip CHỈ gồm
-----------
  shop-drawing/san/app/index.html
  shop-drawing/san/app/assets/
  shop-drawing/san/app/fonts/

KHÔNG đóng gói: san/index.php, shop-drawing/app/, membership.js,
shop-drawing/index.html, favicon thừa.

Cài đặt
-------
1. Tải shop-drawing-san-app-hosting.zip
2. Giải nén → copy vào:
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

Build local (agent)
-------------------
  Vite base "./" + patch từ patches/san/
  → dist/ đóng gói thành shop-drawing/san/app/

Kiểm tra
--------
  Zip không chứa membership.js
  index.html có redirect hub + script membership hub
