# Shop drawing thép móng cọc — 4 dạng đài

Patch mở rộng app móng đơn [`ntgiahuy/mong`](https://github.com/ntgiahuy/mong) theo sơ đồ khuyến nghị:

| Hình | Số cọc | Dạng đài | Thép X/Y |
|------|--------|----------|----------|
| 1 | 2 | Chữ nhật `(α+1)∅ × (∅+300)` | Đều |
| 2 | 3 | **Lục giác** đáy `(α+1)∅+300`, đỉnh `∅+300`, 60° | **Biến thiên** |
| 3 | 4 | Vuông (`αX=αY`) hoặc chữ nhật (`αX≠αY`) | Đều |
| 4 | 5 | Vuông/chữ nhật + cọc giữa, cạnh `√(2α+1)·∅+300` | Đều |

## Hai lớp thép độc lập

- Phương X / Y: `dFaX`, `aFaX`, `dFaY`, `aFaY`
- `bottomLayerX`: lớp dưới là X (lớp trên = phương còn lại)
- **Móc lớp dưới** (`hookedBottom`, `hookBottomLeft/Right`) **có thể khác** lớp trên (`hookedTop`, `hookTopLeft/Right`)
- `minClearLen`: lọc thanh mép quá ngắn (mặc định 200 mm trên mẫu lục giác)

## Chạy demo

```bash
cd patches/mong-coc
npm install
npm test
# → demo/index.html (catalog 4 hình)
# → demo/shop-mc-3c.svg (mặt bằng + mặt cắt + nổ thép + bảng TK)

cd demo && python3 -m http.server 8765
# view3d.html — xoay mô hình 3D
```

## File chính

| File | Vai trò |
|------|---------|
| `types.ts` | Input 2 lớp móc + αX/αY |
| `geometry.ts` | 4 dạng đài theo sơ đồ |
| `rebar.ts` / `calc.ts` | Cắt chord + thống kê theo lớp |
| `view3d.ts` / `svg.ts` | 3D + mặt bằng |
| `sample.ts` | MC-2C … MC-5C |
| `AGENT-MONG-COC.md` | Prompt agent repo `mong` |

## Tích hợp `mong`

Xem [`AGENT-MONG-COC.md`](./AGENT-MONG-COC.md): form chọn số cọc 2/3/4/5, nhập αX/αY, Ø/a/móc từng lớp, shop + PDF/DXF.
