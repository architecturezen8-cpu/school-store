#!/usr/bin/env bash
# ------------------------------------------------------------------
#  Browser QA rig — real Chromium + agent-browser, no Chrome download
# ------------------------------------------------------------------
#  The sandbox cannot reach googlechromelabs / cdn.playwright.dev, so the
#  browser binary comes from the npm registry instead:
#
#    @sparticuz/chromium@143  → a Linux chromium build that still ships the
#                               NSS/NSPR libs it needs (newer versions link
#                               against system libs that are not installable
#                               here because deb.debian.org is blocked).
#
#  Both are unpacked under /tmp, so nothing is added to this repo.
#
#  Usage:
#    bash scripts/browser-qa.sh install     # one-time (≈70 MB download)
#    bash scripts/browser-qa.sh ab <args>   # run agent-browser with the browser
#    bash scripts/browser-qa.sh shot <url> <out.png> [mobile]
#    bash scripts/browser-qa.sh audit <url> # axe-core a11y violations
# ------------------------------------------------------------------
set -euo pipefail

CHROME_DIR="${CHROME_DIR:-/tmp/chrome143}"
CHROME_BIN="$CHROME_DIR/chromium"
LIB_DIR="$CHROME_DIR/lib"
PKG_VERSION="143.0.4"

install() {
  echo "› installing @sparticuz/chromium@$PKG_VERSION (npm registry)…"
  rm -rf /tmp/chrome-src && mkdir -p /tmp/chrome-src
  ( cd /tmp/chrome-src && npm pack "@sparticuz/chromium@$PKG_VERSION" --silent >/dev/null && tar xzf ./*.tgz )

  echo "› unpacking browser + libraries into $CHROME_DIR…"
  rm -rf "$CHROME_DIR" && mkdir -p "$CHROME_DIR"
  node -e '
    const fs = require("fs"), zlib = require("zlib");
    const src = "/tmp/chrome-src/package/bin";
    fs.writeFileSync(process.argv[1] + "/chromium",
      zlib.brotliDecompressSync(fs.readFileSync(src + "/chromium.br")));
    fs.writeFileSync("/tmp/chrome-libs.tar",
      zlib.brotliDecompressSync(fs.readFileSync(src + "/al2023.tar.br")));
  ' "$CHROME_DIR"
  chmod +x "$CHROME_BIN"
  tar xf /tmp/chrome-libs.tar -C "$CHROME_DIR"

  echo "› checking browser launches…"
  LD_LIBRARY_PATH="$LIB_DIR" "$CHROME_BIN" --version

  if ! command -v agent-browser >/dev/null; then
    echo "› installing agent-browser CLI…"
    npm install -g agent-browser
  fi
  echo "✓ ready — run: bash scripts/browser-qa.sh shot '#/shop' /tmp/shop.png"
}

ab() {
  LD_LIBRARY_PATH="$LIB_DIR" AGENT_BROWSER_EXECUTABLE_PATH="$CHROME_BIN" \
    agent-browser --executable-path "$CHROME_BIN" "$@"
}

serve() {
  # static production build (docs/) — start once, keep running
  if ! curl -sf -o /dev/null http://localhost:8080/; then
    echo "› docs/ is not being served on :8080 — run:"
    echo "  python3 -m http.server 8080 --bind 0.0.0.0 --directory docs"
  fi
}

shot() {
  local route="$1" out="$2" device="${3:-}"
  serve
  [ -n "$device" ] && ab set device "$device" >/dev/null
  ab open "http://localhost:8080/?v=$(date +%s%N)$route" >/dev/null
  sleep 2
  ab screenshot "$out" >/dev/null
  echo "✓ $out"
}

audit() {
  local route="${1:-/#/}"
  serve
  ab open "http://localhost:8080/?v=$(date +%s%N)$route" >/dev/null
  sleep 2
  ab a11y --json > /tmp/qa-a11y.json
  python3 "$(dirname "$0")/axe-report.py" /tmp/qa-a11y.json
}

case "${1:-}" in
  install) install ;;
  ab) shift; ab "$@" ;;
  shot) shift; shot "$@" ;;
  audit) shift; audit "$@" ;;
  *) sed -n '2,22p' "$0"; exit 1 ;;
esac
