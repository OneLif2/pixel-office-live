#!/usr/bin/env bash
# Guard the public/static boundary: the exported site must never call /api/*.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d out ] || { echo "run 'npm run build' first (no out/ directory)" >&2; exit 1; }

if grep -rn "fetch(['\"]/api/" app lib --include='*.ts' --include='*.tsx'; then
  echo "FAIL: source contains /api/ fetch calls" >&2
  exit 1
fi
if grep -rln '"/api/' out/_next/static/chunks 2>/dev/null; then
  echo "FAIL: built chunks reference /api/" >&2
  exit 1
fi
echo "OK: no /api references in source or built output"
