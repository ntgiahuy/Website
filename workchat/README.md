# GiaHuy Work — Messenger nội bộ kiểu Telegram

Ứng dụng chat nhóm làm việc cho công ty, giao diện gần giống Telegram Web, chạy trên GitHub Pages (hosting tĩnh).

## Địa chỉ

- **App:** https://ntgiahuy.github.io/home/workchat/
- **Local:** mở `workchat/index.html` hoặc phục vụ thư mục repo bằng static server

## Tính năng

- Đăng nhập / tạo tài khoản nội bộ (tên + chức vụ + công ty)
- 5 tài khoản demo sẵn (quản lý, kết cấu, giám sát, kế toán, shop drawing)
- Danh sách chat, thư mục Tất cả / Nhóm / Riêng tư
- Tạo nhóm làm việc, chat 1-1
- Tin nhắn realtime giữa các tab cùng trình duyệt (`BroadcastChannel` + `localStorage`)
- Panel thông tin nhóm & thành viên
- Chế độ tối / sáng
- Giao diện mobile (danh sách ↔ khung chat)

## Giới hạn hosting tĩnh

GitHub Pages không có máy chủ realtime. Dữ liệu lưu trên trình duyệt (`localStorage`). Nhiều máy/thiết bị khác nhau **không** đồng bộ trừ khi gắn backend (Firebase, Supabase, Cloudflare Worker…).

Để dùng thật nhiều người trên nhiều máy: cần thêm API/WebSocket — có thể mở rộng từ `workers/` trong repo.
