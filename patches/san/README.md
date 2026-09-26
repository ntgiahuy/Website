# Patch: Khoảng rải theo số hiệu (STT #1, #4)

Mỗi số hiệu thép (Ø + a + chiều dài phát triển + móc) có khoảng rải riêng trên minh họa và PDF.

- Thanh ngắn / sàn thấp cắt: khoảng rải neo đúng bao ô (không gộp lan mất dầm).
- `slabDistRangeForBar` chỉ lan ô giao đoạn thanh; fallback sàn xéo giữ hành vi cũ.
- Preview/PDF đưa L+móc vào `markKey` khi gộp khoảng rải; thống kê vùng vẫn gộp theo mark vùng.
