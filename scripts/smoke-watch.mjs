/**
 * ------------------------------------------------------------------
 *  SMOKE WATCH — re-runs the smoke test whenever src/ changes
 * ------------------------------------------------------------------
 *  Usage:  node scripts/smoke-watch.mjs
 *
 *  Keeps a single line summary at the top of `verify/smoke-report.json`
 *  and prints a "diff" of newly appeared problems, so a long-running
 *  agent/browser session can spot regressions without clicking through
 *  the UI by hand.
 */
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WATCH_DIRS = ["src"];
let running = false;
let queued = false;
const known = new Set();

function run() {
  if (running) {
    queued = true;
    return;
  }
  running = true;
  const started = Date.now();
  const child = spawn(process.execPath, ["scripts/smoke.mjs"], { cwd: ROOT });

  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));

  child.on("close", (code) => {
    running = false;
    const stamp = new Date().toLocaleTimeString();
    console.log(`\n──────── ${stamp} · ${((Date.now() - started) / 1000).toFixed(1)}s · exit ${code} ────────`);
    console.log(out.trim());

    const fresh = [];
    for (const line of out.split("\n")) {
      const m = line.match(/^\s+(!|✗)\s+(.*)$/);
      if (!m) continue;
      const key = m[2].trim();
      if (!known.has(key)) fresh.push(key);
    }
    known.clear();
    for (const line of out.split("\n")) {
      const m = line.match(/^\s+(!|✗)\s+(.*)$/);
      if (m) known.add(m[2].trim());
    }
    if (fresh.length) {
      console.log("\n▲ NEW since last run:");
      for (const f of fresh) console.log(`  · ${f}`);
    } else if (code === 0) {
      console.log("▲ no new problems");
    }

    if (queued) {
      queued = false;
      run();
    }
  });
}

console.log("smoke-watch: watching src/ — first run in progress…");
run();

let timer;
for (const dir of WATCH_DIRS) {
  watch(path.join(ROOT, dir), { recursive: true }, (_event, file) => {
    if (!file || !/\.(tsx?|css|html)$/.test(file)) return;
    clearTimeout(timer);
    timer = setTimeout(run, 700);
  });
}
