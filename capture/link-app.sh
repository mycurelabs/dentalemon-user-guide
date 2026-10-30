#!/usr/bin/env bash
# Point this folder at a monorepo checkout's Playwright, so the capture scripts
# and the app's e2e helpers (imported through APP_DIR) share one Playwright
# instance. Two copies refuse to load together.
#
#   ./link-app.sh /path/to/monobase-mycure
set -euo pipefail
ROOT=${1:?usage: ./link-app.sh /path/to/monorepo-checkout}
NM="$ROOT/node_modules"
test -d "$NM/@playwright/test" || { echo "No Playwright in $NM; run bun install there first." >&2; exit 1; }
cd "$(dirname "$0")"
mkdir -p node_modules/@playwright node_modules/.bin
ln -sfn "$NM/@playwright/test" node_modules/@playwright/test
ln -sfn "$NM/playwright" node_modules/playwright
ln -sfn "$NM/playwright-core" node_modules/playwright-core
ln -sfn ../playwright/cli.js node_modules/.bin/playwright
mkdir -p app-e2e
# Type-only view of the app's helpers for editors (gitignored).
for f in sign-in.ts charges-cashier.fixtures.ts tooth-entry.ts patient-page.fixtures.ts e2e.config.ts; do
  ln -sfn "$ROOT/apps/dentalemon/e2e/$f" "app-e2e/$f"
done
echo "Linked Playwright from $ROOT"
