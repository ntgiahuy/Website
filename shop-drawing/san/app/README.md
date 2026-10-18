# Upload Shop drawing (san) vào đây

Agent build xong → upload **toàn bộ file tĩnh** (index.html + assets) vào thư mục này:

```
public_html/shop-drawing/san/app/
  index.html
  assets/...
  assets/mobile-fit.css   # giữ lại khi ghi đè build mới
```

`mobile-fit.css` chỉnh layout mobile/iframe (không dùng `100dvh` trong hub, tránh tràn ngang).
Sau khi upload build mới từ agent, giữ hoặc gắn lại thẻ:

```html
<link rel="stylesheet" href="./assets/mobile-fit.css">
```

Đối tác **không** nhúng `.../san/app/` trực tiếp.
Nhúng cổng đã khóa domain:

```html
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/san/" width="100%" height="980" style="border:0" allow="download"></iframe>
```

`index.php` ở thư mục cha kiểm tra tên miền tab **Đối tác**.
