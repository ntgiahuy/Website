# Agents Shop Drawing · upload trong `shop-drawing/` + domain Đối tác

## Cấu trúc hosting

```
public_html/shop-drawing/
  admin/                 # Thành viên + Đối tác
  api/
  mong/
    index.php            # Cổng kiểm tra domain
    app/                 # ← upload build agent móng đơn
  cot/
    index.php
    app/                 # ← upload build agent cột
  dam/
    index.php
    app/                 # ← upload build agent dầm
  san/
    index.php
    app/                 # ← upload build agent sàn
```

## Kết luận

| Agent | Upload vào | Tab Đối tác? | Header hub? | Auth thành viên? |
|-------|------------|--------------|-------------|------------------|
| Móng đơn | `shop-drawing/mong/app/` | **Không** (cổng PHP) | **Không** | **Có** nếu khóa PDF: dùng `membership.js` hosting |
| Cột | `shop-drawing/cot/app/` | **Không** | **Không** | **Có** nếu khóa PDF |
| Dầm | `shop-drawing/dam/app/` | **Không** | **Không** | **Có** nếu khóa PDF |
| Sàn | `shop-drawing/san/app/` | **Không** | **Không** | **Có** nếu khóa PDF |

Tab **Đối tác** chỉ ảnh hưởng cổng `.../mong|cot|dam|san/` (`index.php`).  
Header / đăng nhập / đăng ký nằm ở hub `shop-drawing/index.html`, `dang-nhap/`, `dang-ky/`.

Auth hiện tại: đăng ký username+email+mật khẩu (OTP lần đầu) · đăng nhập username+mật khẩu · admin cấp theo username.  
App shop **không** tự làm form email OTP. Khóa PDF:

```html
<script src="/shop-drawing/assets/membership.js"
        data-api="/shop-drawing/api/"
        data-activate-url="/shop-drawing/dang-nhap/"></script>
```

## Đối tác nhúng

```html
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/mong/" ...></iframe>
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/cot/" ...></iframe>
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/dam/" ...></iframe>
<iframe src="https://YOUR-DOMAIN.com/shop-drawing/san/" ...></iframe>
```

Không nhúng `.../mong/app/` trực tiếp.

## Tin nhắn dán agent

- [prompts/AGENT-MONG-DON.md](./prompts/AGENT-MONG-DON.md)
- [prompts/AGENT-COT.md](./prompts/AGENT-COT.md)
- [prompts/AGENT-DAM.md](./prompts/AGENT-DAM.md)
- [prompts/AGENT-SAN.md](./prompts/AGENT-SAN.md)
