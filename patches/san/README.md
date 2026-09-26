# Patch: bỏ số thứ tự trước tên tab / panel

Tab và tiêu đề panel không còn `1.`, `2.`, … — chỉ còn tên chức năng.

```bash
cd san
git am patches/san/bo-so-thu-tu-tab.patch
# hoặc copy types.ts → lib/types.ts, SlabApp.tsx → components/slab/
npm run build && rm -rf docs && cp -a out/. docs/ && touch docs/.nojekyll
```
