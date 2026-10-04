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

| Agent | Upload vào | Sửa code để đọc tab Đối tác? |
|-------|------------|------------------------------|
| Móng đơn | `shop-drawing/mong/app/` | **Không** |
| Cột | `shop-drawing/cot/app/` | **Không** |
| Dầm | `shop-drawing/dam/app/` | **Không** |
| Sàn | `shop-drawing/san/app/` | **Không** |

Tab **Đối tác** chỉ ảnh hưởng cổng `.../mong|cot|dam|san/` (file `index.php`).  
App trong `app/` chỉ hiện sau khi cổng cho phép.

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
