# Patch: chèn dầm giữa ô → thêm trục, tách ô độc lập

Khi **Chèn dầm** Phương X / Y vào giữa ô sàn, app thêm trục lưới (không còn dầm `free`) để:

- 1 dầm → **2 ô** độc lập
- Phương X + Y → **4 ô** độc lập (trên 1 ô gốc)

## Áp dụng lên `ntgiahuy/san`

```bash
cd san
git am patches/san/chen-dam-tach-o-doc-lap.patch
# hoặc copy đè:
# cp patches/san/grid.ts lib/grid.ts
# cp patches/san/SlabApp.tsx components/slab/SlabApp.tsx
# cp patches/san/SlabPreview.tsx components/slab/SlabPreview.tsx
npm run build && rm -rf docs && cp -a out/. docs/ && touch docs/.nojekyll
git add -A && git commit -m "fix: chèn dầm giữa ô thêm trục để tách ô độc lập"
git push origin main
```

Nhánh agent (local): `cursor/chen-dam-tach-o-doc-lap-e9b6` trong worktree `/tmp/san-work`.

## Kiểm chứng

```bash
npx tsx scripts/test-insert-split.ts
# 1 ô → X → 2 ô; X+Y → 4 ô
```
