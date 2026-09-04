# Website CDN — GiaHuy.Net

Repo phục vụ file tĩnh tại **https://xd.giahuy.net/** (GitHub Pages).

## Trang chủ 3 tiện ích

**https://xd.giahuy.net/hub/**

- Nhúng Cột · Móng · Dầm trong một trang
- Dùng thử **10 phút / 1 lần** mỗi trình duyệt
- Hết giờ → đăng ký thành viên: 3 tháng, 6 tháng, 1 năm, 2 năm, 3 năm, 5 năm, vĩnh viễn

## Thành viên trả phí theo thời gian

| Trang | Địa chỉ |
|-------|---------|
| Trang chủ hub | https://xd.giahuy.net/hub/ |
| Đăng ký / kích hoạt | https://xd.giahuy.net/thanh-vien/ |
| Admin tạo mã | https://xd.giahuy.net/thanh-vien/admin.html |
| Thư viện JS | https://xd.giahuy.net/js/membership.js |
| Bảng giá gói | https://xd.giahuy.net/thanh-vien/plans.json |
| Hướng dẫn tích hợp | [thanh-vien/HUONG-DAN.md](thanh-vien/HUONG-DAN.md) |
| Bảo mật Public/Private | [thanh-vien/BAO-MAT.md](thanh-vien/BAO-MAT.md) |

Sửa STK trong `thanh-vien/pay-config.json`. Sửa giá trong `thanh-vien/plans.json`. **Private key** chỉ giữ trên máy (Admin → Import).

**Repo `cot` / `mong` / `dam` đang Public:** nên đổi sang **Private** — xem [thanh-vien/BAO-MAT.md](thanh-vien/BAO-MAT.md). Worker mẫu: `workers/license-verify/`.
