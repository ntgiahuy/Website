# Patches for ntgiahuy/san

Đã **push trực tiếp lên `main`** của `ntgiahuy/san` (commit `15cec30`) và GitHub Pages:
https://ntgiahuy.github.io/san/

## Hành vi (dầm theo tim trục)

Khi nhập/đổi khoảng cách tim trục:
- **Trục giữa:** dầm căn tâm (B1 = B/2)
- **Trục biên đầu:** tim = da dầm ngoài lo (B1 = 0)
- **Trục biên cuối:** tim = da dầm ngoài hi (B1 = B)

## File nguồn

- `grid.ts` — `beamOffsetForAxisIndex`, `syncBeamsToAxes`, `applyAxesToProject`
- `SlabApp.tsx` — gọi sync khi sửa B / nhịp trục
- `sample.ts` — mẫu khởi tạo qua `applyAxesToProject`
- `dam-theo-tim-truc-bien.patch` — patch 3 file nguồn (không gồm docs/)
