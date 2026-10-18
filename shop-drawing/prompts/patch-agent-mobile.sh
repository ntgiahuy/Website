#!/usr/bin/env bash
# Patch CSS/layout mobile trong repo agent móng/cột/dầm/sàn.
# Home shop-drawing hub KHÔNG bị sửa bởi script này.
#
# Usage:
#   chmod +x patch-agent-mobile.sh
#   ./patch-agent-mobile.sh /path/to/parent
# parent phải chứa thư mục: mong  cot  dam  san
set -euo pipefail

ROOT="${1:-.}"
ROOT="$(cd "$ROOT" && pwd)"

echo "==> Parent: $ROOT"

append_once() {
  local file="$1"
  local marker="$2"
  local block="$3"
  [[ -f "$file" ]] || return 1
  if grep -qF "$marker" "$file"; then
    echo "  already: $file"
    return 0
  fi
  printf '\n%s\n' "$block" >> "$file"
  echo "  updated: $file"
}

# ---------- MONG ----------
MONG="$ROOT/mong"
if [[ -d "$MONG" ]]; then
  echo "==> Patch mong"
  MONG_BLOCK='/* mobile iframe fit — screen only */
html, body, #root, .app {
  height: 100%;
  max-width: 100%;
  margin: 0;
  overflow-x: hidden;
  box-sizing: border-box;
}
@media screen {
  html, body, #root, .app {
    height: 100% !important;
    max-width: 100% !important;
    overflow: hidden !important;
  }
  .topbar, .workspace, .form-cols, .side {
    min-width: 0;
    max-width: 100%;
  }
  .top-actions, .mode-switch {
    flex-wrap: wrap;
    max-width: 100%;
  }
}
@media screen and (max-width: 760px) {
  .app { padding-left: 0.5rem; padding-right: 0.5rem; }
  .shop-scroll { max-width: 100%; overflow: auto; }
}'
  patched=0
  for css in "$MONG/src/index.css" "$MONG/src/App.css" "$MONG/src/styles.css"; do
    if [[ -f "$css" ]]; then
      append_once "$css" "mobile iframe fit" "$MONG_BLOCK" || true
      patched=1
    fi
  done
  if [[ "$patched" -eq 0 ]]; then
    mkdir -p "$MONG/src"
    append_once "$MONG/src/mobile-iframe.css" "mobile iframe fit" "$MONG_BLOCK" || true
    echo "  NOTE: thêm import './mobile-iframe.css' vào entry (main.tsx / App.tsx)"
  fi
else
  echo "SKIP mong"
fi

# ---------- COT ----------
COT="$ROOT/cot"
if [[ -d "$COT" ]]; then
  echo "==> Patch cot"
  if [[ -f "$COT/src/App.css" ]]; then
    python3 - "$COT/src/App.css" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
t = p.read_text(encoding="utf-8")
n = t.replace("min-height: 100vh;", "height: 100%;\n  max-height: 100%;")
n = n.replace("url(/cot/", "url(./").replace("url('/cot/", "url('./").replace('url("/cot/', 'url("./')
extra = """
/* mobile iframe fit */
html, body, #root {
  height: 100%;
  max-width: 100%;
  overflow-x: hidden;
}
@media (max-width: 760px) {
  .site-header img { max-height: 2rem; width: auto; }
  .brand-copy, .app-shell, .workspace, .sidebar, .elevation-board {
    min-width: 0;
    max-width: 100%;
  }
}
"""
if "mobile iframe fit" not in n:
    n = n.rstrip() + "\n" + extra + "\n"
if n != t:
    p.write_text(n, encoding="utf-8")
    print("  updated:", p)
else:
    print("  no change:", p)
PY
  fi
  if [[ -f "$COT/src/index.css" ]]; then
    append_once "$COT/src/index.css" "mobile iframe fit" \
'/* mobile iframe fit */
html, body, #root {
  height: 100%;
  max-width: 100%;
  overflow-x: hidden;
}' || true
  fi
else
  echo "SKIP cot"
fi

replace_hdvh() {
  local dir="$1"
  local count=0
  while IFS= read -r -d '' f; do
    if grep -q 'h-dvh' "$f"; then
      python3 - "$f" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
t = p.read_text(encoding="utf-8")
n = t.replace("flex h-dvh flex-col", "flex h-full flex-col")
n = n.replace(" h-dvh ", " h-full ")
n = n.replace('h-dvh"', 'h-full"').replace("h-dvh'", "h-full'")
if n != t:
    p.write_text(n, encoding="utf-8")
    print("  updated:", p)
PY
      count=$((count + 1))
    fi
  done < <(find "$dir" -type f \( -name '*.tsx' -o -name '*.jsx' -o -name '*.ts' -o -name '*.js' -o -name '*.css' \) \
    ! -path '*/node_modules/*' ! -path '*/.next/*' ! -path '*/docs/*' ! -path '*/dist/*' -print0 2>/dev/null || true)
  echo "  files with h-dvh touched/checked under $dir"
}

add_globals_height() {
  local repo="$1"
  local block='/* mobile iframe fit */
html, body, #root, #__next {
  height: 100%;
  max-width: 100%;
  overflow: hidden;
}'
  local found=0
  for g in "$repo/app/globals.css" "$repo/src/app/globals.css" "$repo/styles/globals.css" "$repo/app/global.css" "$repo/src/index.css"; do
    if [[ -f "$g" ]]; then
      append_once "$g" "mobile iframe fit" "$block" || true
      found=1
    fi
  done
  if [[ "$found" -eq 0 ]]; then
    mkdir -p "$repo/app"
    append_once "$repo/app/globals.css" "mobile iframe fit" "$block" || true
    echo "  NOTE: đảm bảo layout import globals.css"
  fi
}

# ---------- DAM ----------
DAM="$ROOT/dam"
if [[ -d "$DAM" ]]; then
  echo "==> Patch dam"
  replace_hdvh "$DAM"
  add_globals_height "$DAM"
else
  echo "SKIP dam"
fi

# ---------- SAN ----------
SAN="$ROOT/san"
if [[ -d "$SAN" ]]; then
  echo "==> Patch san"
  replace_hdvh "$SAN"
  add_globals_height "$SAN"
else
  echo "SKIP san"
fi

echo
echo "Done. Build từng repo rồi upload vào shop-drawing/<app>/app/"
echo "Tin nhắn dán chi tiết: shop-drawing/prompts/AGENT-MOBILE.md"
