# Patch: căn giữa ký hiệu trục trong vòng tròn

Áp dụng lên repo `ntgiahuy/san` (branch `main`):

```bash
cd san
git am < patches/san/truc-bubble-giua-tam.patch
# hoặc copy:
#   lib/pdf/generate.ts
#   components/slab/SlabPreview.tsx
```

Hành vi: số hiệu trục (A/B/1/2…) nằm giữa tâm vòng bubble trên PDF (bbox mực glyph) và preview SVG (`dominantBaseline="central"`).
