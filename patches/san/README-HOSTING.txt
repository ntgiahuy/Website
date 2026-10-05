Shop drawing thép sàn — gói chạy độc lập (hosting tĩnh)
=======================================================

Cấu trúc (chỉ file cần thiết)
-----------------------------
  index.html
  assets/index-*.js      ← app + thư viện xuất PDF (pdf-lib) đã đóng gói sẵn
  assets/index-*.css
  fonts/*.ttf            ← font nhúng khi Xuất PDF
  fonts/*.woff2          ← font giao diện

Không kèm: favicon, membership.js, public-jwk.json, file PDF mẫu.

Về file PDF
-----------
Không có file .pdf sẵn trong zip. PDF được tạo ngay trong trình duyệt
khi bấm nút «Xuất PDF» (dùng JS + fonts/*.ttf). Lưu file kết quả từ
hộp thoại tải xuống của trình duyệt.

Chạy
----
  npx --yes serve -l 5173 .
  # hoặc: python3 -m http.server 5173
  Mở http://localhost:5173/ (hoặc domain hosting của bạn)

Ghi chú
-------
- Mọi liên kết dùng đường dẫn tương đối (./) — không cần CDN ngoài.
- Gói này giống bước cột Lớp = Ø / nhãn Lớp dưới·trên / mặt cắt TL 1/75:
  không khóa xuất PDF bằng membership.
