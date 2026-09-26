# Patch: dầm tự theo tim trục khi đổi số lượng trục

Áp dụng lên repo `ntgiahuy/san` (branch `main`):

```bash
cd san
git am < patches/san/dam-theo-tim-truc.patch
# hoặc cherry-pick các commit trên nhánh cursor/dam-theo-tim-truc-e9b6 trong /tmp/san-work
```

Hành vi: sửa **Số lượng trục X/Y** → chia đều trục và tạo/cập nhật dầm tại tim từng trục; form **Số lượng dầm** cập nhật theo.
