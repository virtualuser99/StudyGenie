#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGES=(
  "backend"
  "frontend"
  "artifacts/mockup-sandbox"
)

for package_path in "${PACKAGES[@]}"; do
  package_dir="$ROOT_DIR/$package_path"
  if [[ ! -f "$package_dir/package.json" || ! -f "$package_dir/package-lock.json" ]]; then
    echo "Missing package manifest or lockfile in $package_path" >&2
    exit 1
  fi

  echo "Installing dependencies for $package_path"
  npm --prefix "$package_dir" install --no-audit --no-fund --no-progress
done

echo "Building frontend"
(
  cd "$ROOT_DIR/frontend"
  node node_modules/vite/bin/vite.js build
)

echo "Building mockup sandbox"
(
  cd "$ROOT_DIR/artifacts/mockup-sandbox"
  PORT="${PORT:-23636}" BASE_PATH="${BASE_PATH:-/}" \
    node node_modules/vite/bin/vite.js build --config vite.config.ts
)
