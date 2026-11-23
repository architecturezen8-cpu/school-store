#!/usr/bin/env bash
# One-time browser-harness setup (not part of the app).
#
# Playwright cannot download its browser here (CDN blocked), so we launch the
# Chromium that @sparticuz/chromium ships on npm and unpack the shared libraries
# it links against from the same package's Lambda layer.
set -euo pipefail

QA_ENV="${QA_ENV:-/tmp/qaenv}"
QA_LIBS="${QA_LIBS:-/tmp/al}"

mkdir -p "$QA_ENV" "$QA_LIBS"
[ -d "$QA_ENV/node_modules/playwright-core" ] || (
  cd "$QA_ENV" && npm init -y >/dev/null && npm i playwright-core @sparticuz/chromium axe-core --no-audit --no-fund
)

node -e '
const fs = require("fs"), zlib = require("zlib"), path = require("path");
const pkg = path.join(process.argv[1], "@sparticuz", "chromium");
const br = path.join(pkg, "bin", "al2023.tar.br");
fs.writeFileSync("/tmp/al2023.tar", zlib.brotliDecompressSync(fs.readFileSync(br)));
' "$QA_ENV/node_modules"

tar -xf /tmp/al2023.tar -C "$QA_LIBS"
echo "harness ready: QA_MODULES=$QA_ENV/node_modules QA_LIBS=$QA_LIBS/lib"
