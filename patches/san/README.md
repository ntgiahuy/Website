# Patch: bỏ nút Thống kê / Vẽ thép sàn từng thanh

Loại bỏ:
- **Thống kê Dầm** (tab Số liệu dầm)
- **Thống kê thép sàn** (tab tiết kiệm / đơn giản)
- **Vẽ thép sàn từng thanh** (tab tiết kiệm / đơn giản)

```bash
cd san
git am patches/san/xoa-nut-thong-ke-ve-tung-thanh.patch
npm run build && rm -rf docs && cp -a out/. docs/ && touch docs/.nojekyll
```
