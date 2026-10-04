# Agents Shop Drawing · nhận domain từ tab Đối tác?

## Kết luận ngắn

| Agent / app | Cần sửa để nhận domain từ tab Đối tác? |
|-------------|----------------------------------------|
| Shop drawing **móng đơn** (`mong`) | **Không** |
| Shop drawing **cột** (`cot`) | **Không** |
| Shop drawing **dầm** (`dam`) | **Không** |
| Shop drawing **sàn** (`san`) | **Không** |

Danh sách tên miền ở Admin → **Đối tác** chỉ được đọc bởi cổng PHP trên hosting:

```
https://YOUR-DOMAIN.com/shop-drawing/mong/
https://YOUR-DOMAIN.com/shop-drawing/cot/
https://YOUR-DOMAIN.com/shop-drawing/dam/
https://YOUR-DOMAIN.com/shop-drawing/san/
```

App shop (github.io / repo riêng) chỉ là nội dung bên trong iframe sau khi cổng đã cho phép.

## Việc đúng của từng phía

### Hosting `shop-drawing` (đã có)
1. Admin thêm `domain.com` ở tab **Đối tác**
2. Site đối tác nhúng iframe trỏ tới `/shop-drawing/{mong|cot|dam|san}/`
3. PHP kiểm tra Referer / parent domain ∈ allowlist  
   - Đúng → hiện shop  
   - Sai / mở thẳng → `https://www.giahuy.net/`

### Agents móng / cột / dầm / sàn — **không** làm
- Không gọi API `admin_domains`
- Không tự giữ danh sách domain đối tác
- Không nhúng iframe từ `*.github.io/...` trên site đối tác nếu muốn khóa theo domain (sẽ **bỏ qua** allowlist)

### Agents móng / cột / dầm / sàn — chỉ cần (tuỳ chọn)
1. Giữ URL app đúng trong `shop-drawing/config.php` → `apps[].url`  
   (vd. `https://ntgiahuy.github.io/mong/`)
2. Nếu muốn khóa **Xuất PDF** theo thành viên email hosting:

```html
<script src="https://YOUR-DOMAIN.com/shop-drawing/assets/membership.js"
        data-api="https://YOUR-DOMAIN.com/shop-drawing/api/"
        data-activate-url="https://YOUR-DOMAIN.com/shop-drawing/thanh-vien/"></script>
```

```js
const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF", app: "mong" });
if (!ok) return;
```

(`app` lần lượt: `mong` | `cot` | `dam` | `san`)

## Sai lầm thường gặp

Đối tác dán thẳng:

```html
<iframe src="https://ntgiahuy.github.io/mong/" ...></iframe>
```

→ Tab **Đối tác** **không** kiểm soát được. Phải dùng URL hosting `/shop-drawing/mong/`.
