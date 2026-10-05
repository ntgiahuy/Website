Shop drawing thép sàn — gói chạy độc lập (localhost / hosting tĩnh)
================================================================

Cấu trúc (chỉ file cần thiết)
-----------------------------
  index.html
  assets/index-*.js      ← app + thư viện xuất PDF (pdf-lib) đã đóng gói sẵn
  assets/index-*.css
  assets/membership.js   ← kiểm tra thành viên (local, không CDN)
  assets/public-jwk.json
  fonts/*.ttf            ← font nhúng khi Xuất PDF
  fonts/*.woff2          ← font giao diện

Không kèm favicon / ảnh icon / file PDF mẫu.

Về file PDF
-----------
Không có file .pdf sẵn trong zip. PDF được tạo ngay trong trình duyệt
khi bấm nút «Xuất PDF» (dùng JS + fonts/*.ttf). Lưu file kết quả từ
hộp thoại tải xuống của trình duyệt.

Chạy trên localhost
-------------------
  npx --yes serve -l 5173 .
  # hoặc: python3 -m http.server 5173
  Mở http://localhost:5173/

Ghi chú
-------
- Mọi liên kết dùng đường dẫn tương đối (./) — không cần CDN ngoài.
- Trên localhost xuất PDF không bị khóa membership.
