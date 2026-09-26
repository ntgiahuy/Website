# Patch: khoảng rải không bắt qua ô thủng

- `expandContiguous` / accumulate dừng tại ô thủng (và ô không còn thép sàn).
- `bayIndexForBar` neo theo ô giao dài nhất (không fallback stripKey=0 khi mid trên dầm).
- `buildMergedDistRanges` cắt hình học đường khoảng rải tại ô thủng; không gộp qua lỗ trống.
- Thanh điển hình cạnh ô thủng vẫn có khoảng rải riêng.
