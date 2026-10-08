# Tin nhắn dán vào agent Shop drawing móng — móng cọc 4 dạng + 2 lớp thép

Copy khối dưới gửi agent repo [`mong`](https://github.com/ntgiahuy/mong):

---

## Mục tiêu

Mở rộng **móng đơn** thành **móng cọc** theo sơ đồ 4 hình:

1. **2 cọc** — chữ nhật  
2. **3 cọc** — lục giác (thép X & Y biến thiên)  
3. **4 cọc** — vuông hoặc chữ nhật (`αX`, `αY`)  
4. **5 cọc** — vuông/chữ nhật + cọc giữa  

Hai lớp thép đế: Ø, khoảng `a`, **đầu móc lớp dưới có thể khác lớp trên**.

Nguồn sẵn: `https://github.com/ntgiahuy/Website/tree/main/patches/mong-coc`  
(hoặc branch PR chứa `patches/mong-coc/`).

## Input bắt buộc (xem `types.ts` / `DEFAULT_PILE_CAP`)

- `pileCount`: 2 | 3 | 4 | 5  
- `pileDia`, `alpha`, `alphaX`, `alphaY`, `edgeClear` (150 → +300)  
- `dFaX`, `aFaX`, `dFaY`, `aFaY`, `bottomLayerX`  
- `hookedBottom` + `hookBottomLeft/Right`  
- `hookedTop` + `hookTopLeft/Right`  
- `minClearLen` (lọc thanh ngắn)

## Việc làm trong `mong`

1. Copy `src/lib/pile-cap/` từ patch (`types`, `geometry`, `rebar`, `calc`, `svg`, `view3d`, `sample`).  
2. UI: chọn số cọc + hiện đúng form kích thước; ô móc **tách lớp dưới / lớp trên**.  
3. Shop / PDF / DXF: outline đa giác hoặc chữ nhật; bảng thép theo `groups[]` (có `layer`).  
4. Đài 3 cọc: nhiều `lengthKey` mỗi phương; đài 2/4/5: 1 cỡ / phương (trừ khi chữ nhật lệch rất mạnh vẫn đều theo cạnh).  
5. Giữ `GiaHuyMembership.requireActive({ app: "mong" })`.  
6. Test: port `npm test` trong patch — 4 hình + móc dưới≠trên.

## Demo

`patches/mong-coc/demo/index.html` sau `npm test` — catalog đủ 4 hình + bảng nhóm L.
