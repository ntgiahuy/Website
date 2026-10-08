# Tin nhắn dán vào agent Shop drawing móng đơn — tích hợp móng cọc

Copy **toàn bộ khối dưới đây** (từ `---` đến hết) gửi cho agent repo [`mong`](https://github.com/ntgiahuy/mong):

---

# Tích hợp Shop drawing thép móng cọc vào app móng đơn

Repo đích: **`ntgiahuy/mong`** (app đang chạy: https://mong.giahuy.net/).

Giữ nguyên toàn bộ **móng đơn** hiện có. Thêm chế độ **Móng cọc** song song — không phá PDF/DXF/form móng đơn đang ổn.

## Nguồn thuật toán đã có (bắt buộc dùng, đừng viết lại từ zero)

Lấy từ Website PR / branch:

- PR: https://github.com/ntgiahuy/Website/pull/108  
- Branch: `cursor/mong-coc-luc-giac-a956`  
- Thư mục: `patches/mong-coc/`

Sau khi merge main: `https://github.com/ntgiahuy/Website/tree/main/patches/mong-coc`

```bash
# Cách lấy patch về máy agent
git clone --depth 1 -b cursor/mong-coc-luc-giac-a956 https://github.com/ntgiahuy/Website.git /tmp/Website-mong-coc
# Copy:
#   /tmp/Website-mong-coc/patches/mong-coc/{types,geometry,rebar,calc,svg,view3d,shop-sheet,sample}.ts
#   → src/lib/pile-cap/
```

File bắt buộc copy vào `src/lib/pile-cap/`:

| File | Vai trò |
|------|---------|
| `types.ts` | `PileCapInputs`, `VariableBar`, `BarGroup`, … |
| `geometry.ts` | 4 dạng đài (2/3/4/5 cọc) theo sơ đồ α, ∅, +300 |
| `rebar.ts` | Station + cắt chord biên → thép biến thiên |
| `calc.ts` | `computePileCap()`, `DEFAULT_PILE_CAP`, `normalizeInputs` |
| `svg.ts` | Mặt bằng SVG |
| `view3d.ts` | Scene 3D / isometric |
| `shop-sheet.ts` | Sheet: mặt bằng · mặt cắt A-A/B-B · bảng TK chuẩn |
| `sample.ts` | Mẫu MC-2C … MC-5C |

Có thể copy thêm `PileCapPreview.tsx` → `src/components/` nếu dùng React preview.

Chạy kiểm chứng patch trước khi tích hợp:

```bash
cd /tmp/Website-mong-coc/patches/mong-coc && npm i && npm test
# Xem demo/schedule-mc-3c.svg , demo/shop-mc-3c.svg
```

## Phạm vi sản phẩm

### Giữ nguyên móng đơn
- Form lệch tâm / đúng tâm, `Xmong`×`Ymong`, cổ cột, lưới đế `lenMeshX/Y` đều, PDF A2, DXF, Open/Save JSON.

### Thêm móng cọc — 4 hình (sơ đồ khuyến nghị)

1. **2 cọc** — chữ nhật `(α+1)∅ × (∅+300)`, `s=α∅`  
2. **3 cọc** — **lục giác**: đáy `(α+1)∅+300`, đỉnh `∅+300`, 60° — **thép X & Y biến thiên**  
3. **4 cọc** — vuông (`αX=αY`) hoặc chữ nhật (`αX≠αY`): cạnh `(α+1)∅+300`  
4. **5 cọc** — vuông/chữ nhật + cọc giữa: cạnh `√(2α+1)·∅+300`

### Hai lớp thép đế (bắt buộc)
- Phương X / Y: `dFaX`, `aFaX`, `dFaY`, `aFaY`  
- `bottomLayerX`: lớp dưới là X (lớp trên = phương còn lại)  
- **Móc lớp dưới** (`hookedBottom`, `hookBottomLeft`, `hookBottomRight`) **có thể khác** lớp trên (`hookedTop`, `hookTopLeft`, `hookTopRight`)  
- `minClearLen`: lọc thanh mép quá ngắn (mặc định mẫu lục giác 200 mm)  
- `name` = **tên móng** → cột dọc **TÊN CẤU KIỆN** trên bảng TK (không hardcode `D1`)

## UI

1. Thêm chọn **Loại móng**: `Móng đơn` | `Móng cọc`.  
2. Khi **Móng cọc**:
   - Số cọc: 2 / 3 / 4 / 5  
   - ∅ cọc, α (và αX / αY cho đài 4–5 chữ nhật), edgeClear (mặc định 150), H đài, kích thước cột  
   - Thép FaX / FaY (Ø, a)  
   - Tick lớp dưới = X  
   - Khối **Móc lớp dưới** và **Móc lớp trên** tách nhau  
   - Tên móng, SL cấu kiện  
3. Nút **Shop thép** gọi `computePileCap` khi chế độ móng cọc.  
4. Open/Save JSON: thêm field `mode: 'footing' | 'pile-cap'` + `pileCap` inputs; file cũ móng đơn vẫn mở được.

## Shop drawing / PDF / DXF

Khi chế độ móng cọc, bản vẽ gồm:

1. **Mặt bằng** — outline đài (lục giác hoặc chữ nhật) + cọc nét đứt + cột + lưới FaX/FaY (đoạn biến thiên) + đường cắt A-A / B-B  
2. **Mặt cắt A-A / B-B** — chiều cao đài, 2 lớp thép (nét / chấm), móc dưới≠trên  
3. **Bảng thống kê** — **đúng format shop hiện có** (như dầm/móng):

   - Cột dọc **TÊN CẤU KIỆN** = `inputs.name` (tên móng), không phải `D1`  
   - SỐ HIỆU (1a, 1b, …)  
   - HÌNH DẠNG & KÍCH THƯỚC (vẽ U / thẳng + số đoạn)  
   - Ø · CHIỀU DÀI 1 THANH · C.KIỆN · SỐ THANH (MỘT CK / TOÀN BỘ) · TỔNG CHIỀU DÀI (m) · TỔNG TRỌNG LƯỢNG (kg)  
   - Bên phải: **TỔNG HỢP CỐT THÉP** theo Ø + CHIỀU DÀI + TRỌNG LƯỢNG + SỐ THANH 11.7m  
   - Dòng nhóm: `NHÓM Ø≤10` / `10<Ø≤18` / `Ø>18`

Dùng `renderShopSheet` / `renderScheduleOnly` từ `shop-sheet.ts` làm tham chiếu layout; nối vào pipeline PDF/SVG/DXF sẵn có của móng đơn.

**Quan trọng:** đài 3 cọc **không** dùng một `lenMeshX`/`lenMeshY` cố định — mỗi thanh cắt chord với biên lục giác (`groups[]` nhiều `lengthKey`).

## Không làm trong app móng

- Không tự kiểm tra / lưu danh sách tên miền đối tác. Tab **Đối tác** do hosting.  
- Không tự làm trang đăng ký / đăng nhập / OTP / mật khẩu. Auth ở hub hosting.  
- Không nhúng thẳng `.../mong/app/`. Đối tác nhúng cổng iframe hosting.

## Auth hosting (khớp app móng đơn hiện tại)

Khóa **Xuất PDF / DXF** bằng:

```html
<script src="/shop-drawing/assets/membership.js"
        data-api="/shop-drawing/api/"
        data-activate-url="/shop-drawing/dang-nhap/"></script>
```

```js
const ok = await GiaHuyMembership.requireActive({ feature: "Xuất PDF", app: "mong" });
if (!ok) return;
// Xuất PDF / DXF (cả móng đơn và móng cọc)
```

Đăng nhập hub: **username + mật khẩu**. Không dùng `requestOtp` / `verifyOtp` khi xuất file.

## Build / deploy

1. `npm run build` → `dist`  
2. Deploy tĩnh vào `shop-drawing/mong/app/` (`index.html` ở gốc)  
3. Base path: `/shop-drawing/mong/app/` hoặc `./`  
4. GitHub Pages `docs/` vẫn được cho bản public nếu đang dùng

## Tiêu chí chấp nhận

- [ ] Chọn móng đơn → hành vi cũ không đổi  
- [ ] Móng cọc 2/4/5: outline chữ nhật/vuông đúng công thức; mỗi phương ≈ 1 cỡ dài  
- [ ] Móng cọc 3: lục giác 6 cạnh; FaX và FaY **nhiều** chiều dài; gần đỉnh/cạnh nghiêng ngắn hơn  
- [ ] Móc lớp dưới 100+100, lớp trên 150+150 (hoặc giá trị form) phản ánh đúng trên nổ thép / bảng TK  
- [ ] Bảng TK: cột tên cấu kiện = tên móng nhập form; có TỔNG HỢP theo Ø  
- [ ] Xuất PDF/DXF bị khóa membership như cũ  
- [ ] Open/Save JSON 2 mode; file móng đơn cũ vẫn mở  

## Gợi ý thứ tự làm

1. Copy `src/lib/pile-cap/*` từ patch, `npm run build` không lỗi type.  
2. Thêm toggle Loại móng + form móng cọc.  
3. Wire `computePileCap` → preview SVG (`renderPileCapSvg` / `renderShopSheet`).  
4. Nối PDF/DXF + bảng TK chuẩn.  
5. Thêm sample buttons MC-2C / MC-3C / MC-4C / MC-5C từ `sample.ts`.  
6. Kiểm tra tay 4 hình + xuất PDF một lần với tài khoản active.
