# Shop drawing thép sàn

Công cụ nhập số liệu sàn bê tông cốt thép (theo UI shop thép sàn) và **xuất bản vẽ PDF A2** gồm:

- Mặt bằng dầm + vùng thép lớp dưới / trên / cấu tạo
- Shop nổ thanh thép (móc 2 đầu)
- Mặt cắt sàn
- **Bảng thống kê cốt thép** và **Tổng hợp cốt thép** (theo Ø, thanh 11.7 m)

Trọng lượng tính theo `d² / 162.2` (kg/m), nhân với số lượng sàn (SL).

Tham chiếu kiến trúc / PDF từ [Shop drawing thép dầm](https://github.com/ntgiahuy/dam).

## Địa chỉ

- Trên CDN: [https://ntgiahuy.github.io/home/san/](https://ntgiahuy.github.io/home/san/)
- Hub: [https://ntgiahuy.github.io/home/hub/?app=san](https://ntgiahuy.github.io/home/hub/?app=san)

## Chạy local

```bash
cd san-app
npm install
npm run dev
```

Mở `/home/san/` trên cổng dev. Xuất site tĩnh:

```bash
npm run build
# copy out/ → ../san/
```

## Cách dùng

1. **Thông tin sàn** — tên, dày, SL, lớp BV, kích thước dầm X/Y, gán dầm mặt bằng.
2. **Vẽ thép sàn** — số hiệu, Ø, khoảng a, móc trái/phải, phương X/Y.
3. **2 lớp tiết kiệm / đơn giản** — nhập dạng `10a150`, áp dụng preset tự sinh vùng thép.
4. **Mặt cắt / 3D** — tạo mặt cắt trên PDF; xem mô hình 3D đơn giản.
5. **Xuất PDF** — khổ A2 ngang.

Dữ liệu lưu localStorage; **Save As** / **Open** dùng file `[Giahuy.net]-shop_san.json`.
