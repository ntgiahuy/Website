# Patch: Biến thiên L dầm lệch → PDF thống kê 1a/1b/1c

Khi dầm biên / dầm quanh ô thủng / sàn thấp **cắt thép** lệch (Dịch đầu ≠ Dịch cuối), thanh thép X/Y qua dầm có chiều dài khác nhau.

- **Xuất PDF — bảng thống kê**: tách `1a`, `1b`, `1c…` theo bậc chiều dài (≤ 3).
- **Hình minh họa / PDF mặt bằng**: vẫn chỉ số hiệu họ `1` (`planMark`).
- **Đường khoảng rải (minh họa / PDF MB)**: một nét thẳng như sàn chữ nhật (không tách theo từng L), bao dài nhất + neo tại điểm dài nhất (`extentMode: "max"`, `placeAt: "longest"`).
- **Ô hình thang / tam giác / ngũ giác / lục giác**: bố trí thép theo bao dài nhất + cắt theo da dầm → **biến thiên L cả phương X và Y** (PDF TK `1a/1b…` và `2a/2b…`).
