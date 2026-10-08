# Tin nhắn dán vào agent Shop drawing móng — thêm móng cọc lục giác

Copy toàn bộ khối dưới đây gửi cho agent repo [`mong`](https://github.com/ntgiahuy/mong):

---

## Mục tiêu

Mở rộng app **móng đơn** (hình chữ nhật) thành hỗ trợ **đài móng cọc**, ưu tiên **đài 3 cọc lục giác** với **thép đế biến thiên cả phương X và Y**.

Nguồn thuật toán đã có sẵn trên Website:

```
https://github.com/ntgiahuy/Website/tree/main/patches/mong-coc
```

(hoặc branch PR chứa `patches/mong-coc/`). Copy logic — đừng viết lại từ zero.

## Khác biệt bắt buộc so với móng đơn hiện tại

Trong `src/lib/calc.ts` móng đơn:

- `lenMeshX = xMong - 2*cover + hooks` — **một** chiều dài cho mọi thanh FaX  
- `lenMeshY = yMong - 2*cover + hooks` — **một** chiều dài cho mọi thanh FaY  

Với đài lục giác điều đó **sai**. Phải:

1. Xây `outline` đa giác 6 cạnh từ ∅ cọc, α, `edgeClear` (xem `geometry.ts` → `hexagonOutline3`).
2. Với mỗi station lưới, cắt chord với biên (`horizontalChord` / `verticalChord`).
3. Mỗi thanh một `length`; bảng thống kê **gộp theo chiều dài** (`groups` trong `calc.ts`).

Đài 2/4/5 cọc vẫn chữ nhật/vuông (cùng module) — dùng để so sánh: khi đó mỗi phương chỉ còn 1 nhóm dài.

## Việc cần làm trong repo `mong`

1. Thêm thư mục `src/lib/pile-cap/` gồm: `types.ts`, `geometry.ts`, `rebar.ts`, `calc.ts`, `svg.ts`, `sample.ts` (lấy từ `patches/mong-coc`).
2. UI: chế độ **Loại móng** = `Móng đơn` | `Móng cọc`. Khi chọn móng cọc hiện form: số cọc (2/3/4/5), ∅, α, edgeClear, H đài, cột, FaX/FaY, móc, cover.
3. `ShopDrawing`: nếu móng cọc — vẽ outline polygon + cọc tròn nét đứt + lưới thép từng đoạn biến thiên; bảng thép duyệt `result.groups`.
4. PDF / DXF: tái sử dụng pipeline hiện có; lớp thép đế lấy từ `VariableBar[]` / `BarGroup[]`, không hard-code một length.
5. Test: chạy hoặc port `test-geometry.mjs` — đài 3 cọc phải có **≥ 2** `lengthKey` mỗi phương; đài 4 cọc đúng **1** mỗi phương.
6. **Không** tự làm auth / đối tác / OTP — giữ `GiaHuyMembership.requireActive({ feature: "Xuất PDF", app: "mong" })` như prompt móng đơn.
7. Build tĩnh → deploy `shop-drawing/mong/app/` (hoặc GitHub Pages `docs/`) như hiện tại.

## Kiểm tra chấp nhận (hex 3 cọc)

- Mặt bằng lục giác 6 cạnh, 3 cọc đúng tam giác đều `s = α·∅`.
- Thanh FaX gần đỉnh ngắn hơn thanh giữa đài.
- Thanh FaY gần cạnh nghiêng ngắn hơn thanh giữa.
- Bảng thống kê nhiều dòng FaX/FaY với L khác nhau.
- Open/Save JSON vẫn hoạt động (thêm field `mode` / `pileCap`).

## Demo tham chiếu

Sau khi copy patch, có thể mở `patches/mong-coc/demo/index.html` (sinh bằng `npx tsx test-geometry.mjs`) để đối chiếu mặt bằng và bảng nhóm L.
