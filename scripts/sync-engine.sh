#!/usr/bin/env bash
# Vendor the pixel-office engine + assets from the private dashboard app.
# Re-run whenever the dashboard's lib/pixel-office changes.
# UI/engine code only — never copy app/api, lib outside pixel-office, or config.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="../../openclaw-pixel-office"

[ -d "$SRC/lib/pixel-office" ] || { echo "source engine not found: $SRC/lib/pixel-office" >&2; exit 1; }

rm -rf lib/pixel-office
mkdir -p lib public/assets
cp -r "$SRC/lib/pixel-office" lib/pixel-office
rm -rf public/assets/pixel-office
cp -r "$SRC/public/assets/pixel-office" public/assets/pixel-office

# notificationSound.ts calls /api/pixel-office/tracks — the public build has no
# API routes. It is not imported by the engine; remove it so a future import
# fails the build instead of silently 404ing.
rm -f lib/pixel-office/notificationSound.ts

# Patch hardcoded absolute asset URLs to honour the GitHub Pages basePath —
# both single-quoted strings and backtick template literals.
PNG_LOADER=lib/pixel-office/sprites/pngLoader.ts
sed -i "s|'/assets/|ASSET_BASE + '/assets/|g" "$PNG_LOADER"
sed -i 's|`/assets/|`${ASSET_BASE}/assets/|g' "$PNG_LOADER"
sed -i "1i import { ASSET_BASE } from '../../asset-base'" "$PNG_LOADER"

grep -q "ASSET_BASE + '/assets/" "$PNG_LOADER" || { echo "pngLoader basePath patch failed" >&2; exit 1; }
# no asset URL may remain unprefixed (a miss = silent sprite fallback on Pages)
if grep -rnE '(^|[^}+] ?)[\x27\x60]/assets/' lib/pixel-office; then
  echo "FAIL: unprefixed /assets/ URL remains in vendored engine" >&2
  exit 1
fi

echo "engine synced from $SRC"
