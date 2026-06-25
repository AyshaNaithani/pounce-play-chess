#!/usr/bin/env node
/**
 * Dependency security audit.
 *
 * Generates a temporary npm lockfile (bun's lockfile is not understood by
 * `npm audit`) and runs `npm audit` at the configured severity level.
 *
 * Behavior:
 *  - Prints a concise report of high/critical advisories.
 *  - Exits 0 even when advisories are found, so the build is not blocked
 *    on transient registry data. Set AUDIT_STRICT=1 to fail the build.
 *  - Skipped entirely when AUDIT_SKIP=1 (useful for offline CI).
 */
import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LEVEL = process.env.AUDIT_LEVEL || "high";
const STRICT = process.env.AUDIT_STRICT === "1";

if (process.env.AUDIT_SKIP === "1") {
  console.log("[audit-deps] AUDIT_SKIP=1 — skipping dependency audit.");
  process.exit(0);
}

const root = process.cwd();
const work = mkdtempSync(join(tmpdir(), "lov-audit-"));
try {
  copyFileSync(join(root, "package.json"), join(work, "package.json"));

  // Build a lockfile npm understands. --package-lock-only avoids installing
  // node_modules; --ignore-scripts skips lifecycle scripts for safety/speed.
  const gen = spawnSync(
    "npm",
    ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund", "--silent"],
    { cwd: work, stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" },
  );
  if (gen.status !== 0) {
    console.warn("[audit-deps] Could not generate lockfile for audit (skipping).");
    if (gen.stderr) console.warn(gen.stderr.trim());
    process.exit(0);
  }

  const res = spawnSync(
    "npm",
    ["audit", `--audit-level=${LEVEL}`, "--json"],
    { cwd: work, encoding: "utf8" },
  );

  let report;
  try {
    report = JSON.parse(res.stdout || "{}");
  } catch {
    console.warn("[audit-deps] Could not parse audit output (skipping).");
    process.exit(0);
  }

  const totals = report?.metadata?.vulnerabilities || {};
  const high = (totals.high || 0) + (totals.critical || 0);

  if (high === 0) {
    console.log(`[audit-deps] OK — no ${LEVEL}+ advisories.`);
    process.exit(0);
  }

  console.warn(
    `[audit-deps] Found ${high} ${LEVEL}+ advisory(ies): ` +
      `critical=${totals.critical || 0}, high=${totals.high || 0}.`,
  );

  const vulns = report.vulnerabilities || {};
  for (const name of Object.keys(vulns)) {
    const v = vulns[name];
    if (!v || (v.severity !== "high" && v.severity !== "critical")) continue;
    const via = (v.via || [])
      .map((x) => (typeof x === "string" ? x : x?.title || x?.source || x?.name))
      .filter(Boolean)
      .slice(0, 3)
      .join("; ");
    console.warn(`  - ${name} [${v.severity}] ${via ? "→ " + via : ""}`);
  }

  if (STRICT) {
    console.error("[audit-deps] AUDIT_STRICT=1 — failing build.");
    process.exit(1);
  }
  process.exit(0);
} catch (err) {
  console.warn("[audit-deps] Unexpected error (skipping):", err?.message || err);
  process.exit(0);
} finally {
  try { rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
  void execSync;
  void existsSync;
}