# Shop drawing thép móng cọc (đài lục giác)

Patch lõi để **mở rộng app móng đơn** [`ntgiahuy/mong`](https://github.com/ntgiahuy/mong): đài móng cọc 2/3/4/5 cọc, trọng tâm **đài 3 cọc hình lục giác** với **thép đế biến thiên cả phương X và Y**.

## Vì sao khác móng đơn?

| | Móng đơn (`mong`) | Móng cọc 3 cọc (patch này) |
|--|--|--|
| Biên đế | Hình chữ nhật `xMong × yMong` | Lục giác (tam giác đều cắt góc) |
| Thép FaX / FaY | Một `lenMeshX` / `lenMeshY` cho mọi thanh | Mỗi station cắt **chord** với biên → nhiều chiều dài |
| Bảng thống kê | 1 dòng / phương | Nhiều dòng / phương (gộp theo `lengthKey`) |

Công thức sơ đồ điển hình (α, ∅):

- Khoảng tim cọc: `s = α × pileDia` (α thường 2 hoặc 3)
- Đài 3 cọc: 3 cọc tam giác đều 60°, biên lục giác — đoạn phẳng ngoài mỗi cọc `∅ + 2·edgeClear` (mặc định +300 mm)
- Đài 2/4/5: chữ nhật / vuông theo cùng bảng kích thước khuyến nghị

## Thuật toán thép biến thiên

1. `buildGeometry()` → `outline[]` (CCW) + tim cọc + bbox  
2. Station lưới như móng đơn (`cover` + `a`), trên bbox  
3. Với mỗi station:
   - Phương **X** (thanh ngang): `horizontalChord(outline, y, cover)` → `(start, end)`
   - Phương **Y** (thanh dọc): `verticalChord(outline, x, cover)` → `(start, end)`
4. `length = (end − start) + hookLeft + hookRight`  
5. Gộp `lengthKey` (làm tròn 10 mm) → nhóm bảng thống kê  

Gần đỉnh / cạnh nghiêng lục giác → chord ngắn hơn → thép ngắn hơn (đúng shop drawing).

## File

| File | Vai trò |
|------|---------|
| `types.ts` | `PileCapInputs`, `VariableBar`, `BarGroup`, … |
| `geometry.ts` | Lục giác 3 cọc, chữ nhật 2/4/5, cắt chord |
| `rebar.ts` | Station + thanh biến thiên X/Y |
| `calc.ts` | `computePileCap()` — song song `compute()` móng đơn |
| `svg.ts` / `PileCapPreview.tsx` | Mặt bằng SVG |
| `view3d.ts` | Scene 3D + SVG isometric bố trí thép |
| `sample.ts` | Mẫu `MC-3C` |
| `AGENT-MONG-COC.md` | Prompt dán vào agent repo `mong` |
| `demo/` | HTML/SVG/JSON sau khi chạy test (`view3d.html`, `iso3d.svg`) |

## Chạy kiểm tra + demo

```bash
cd patches/mong-coc
npm install
npm test
# → demo/index.html , demo/hex3.svg , demo/iso3d.svg , demo/scene3d.json

# Xoay mô hình 3D (Three.js):
cd demo && python3 -m http.server 8765
# mở http://127.0.0.1:8765/view3d.html
```

## Tích hợp vào `mong`

Xem [`AGENT-MONG-COC.md`](./AGENT-MONG-COC.md). Tóm tắt:

1. Copy các file `types` / `geometry` / `rebar` / `calc` / preview vào `src/lib/pile-cap/` (hoặc tương đương).
2. Thêm tab / chế độ **Móng cọc** cạnh form móng đơn — không phá pipeline PDF/DXF hiện có.
3. Shop drawing: vẽ `outline` đa giác + cọc tròn; bảng thép lặp theo `groups[]` thay vì một dòng FaX/FaY.
4. Giữ `GiaHuyMembership.requireActive({ app: "mong" })` khi xuất PDF/DXF.

## Giới hạn

- Chưa thay thế kiểm tra kết cấu / strut-and-tie / TCVN — chỉ shop thép + hình học biên.
- Đài 3 cọc: biên theo offset phẳng ngoài từng cọc (6 đỉnh); kích thước tổng thể cùng bậc với bảng (α+1)∅+300.
- Chưa có PDF A2 / DXF đầy đủ trong patch — agent `mong` nối vào `pdf.ts` / `dxf.ts` sẵn có.
