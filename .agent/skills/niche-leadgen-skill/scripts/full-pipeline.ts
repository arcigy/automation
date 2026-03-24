#!/usr/bin/env bun
/**
 * scripts/full-pipeline.ts
 * Spustí celý workflow: discovery → enrich → validate → inject.
 * Ideálne na nové niche kde chceš všetko naraz.
 *
 * Použitie:
 *   bun scripts/full-pipeline.ts --niche "stavebniny" --region "Bratislava"
 *   bun scripts/full-pipeline.ts --niche "realitky" --region all-slovakia --min-score 60
 *   bun scripts/full-pipeline.ts --niche "autoservisy" --dry-run
 */

import { parseArgs } from "util";
import { spawnSync } from "child_process";
import { join } from "path";

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    niche:              { type: "string" },
    region:             { type: "string", default: "Bratislava" },
    source:             { type: "string", default: "both" },
    target:             { type: "string", default: "100" },
    "min-score":        { type: "string", default: "50" },
    "create-campaign":  { type: "boolean", default: true },
    "use-ai-sequences": { type: "boolean", default: true },
    "dry-run":          { type: "boolean", default: false },
    quiet:              { type: "boolean", default: false },
    "skip-discovery":   { type: "boolean", default: false },
    "skip-enrich":      { type: "boolean", default: false },
    "skip-inject":      { type: "boolean", default: false },
  },
  strict: false,
});

if (!args.niche) {
  console.error("❌ Chýba --niche parameter."); process.exit(1);
}

const SCRIPTS = join(import.meta.dir);

function step(name: string, cmd: string[]) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🚀 FÁZA: ${name}`);
  console.log(`   Príkaz: ${cmd.join(" ")}`);
  console.log(`${"═".repeat(60)}`);

  const result = spawnSync("bun", cmd, { stdio: "inherit", cwd: process.cwd() });
  if (result.status !== 0) {
    console.error(`\n❌ Fáza "${name}" zlyhala (exit code ${result.status}). Pipeline zastavená.`);
    process.exit(result.status ?? 1);
  }
  console.log(`✅ Fáza "${name}" dokončená.`);
}

async function main() {
  const niche = args.niche as string;
  const dry = (args["dry-run"] as boolean) ? ["--dry-run"] : [];
  const quiet = (args.quiet as boolean) ? ["--quiet"] : [];

  console.log(`\n${"█".repeat(60)}`);
  console.log(`  FULL PIPELINE — Niche: ${niche} | Region: ${args.region}`);
  console.log(`  DryRun: ${args["dry-run"]} | MinScore: ${args["min-score"]}`);
  console.log(`${"█".repeat(60)}\n`);

  const pipelineStart = Date.now();

  // ── FÁZA 1: Discovery ─────────────────────────────────────────────────────
  if (!args["skip-discovery"]) {
    step("Discovery", [
      join(SCRIPTS, "discovery.ts"),
      "--niche", niche,
      "--region", args.region as string,
      "--source", args.source as string,
      "--target", args.target as string,
      "--resume",
      ...dry, ...quiet,
    ]);
  } else {
    console.log("⏭️  Discovery preskočená (--skip-discovery)");
  }

  // ── FÁZA 2: Enrichment ────────────────────────────────────────────────────
  if (!args["skip-enrich"]) {
    step("Enrichment", [
      join(SCRIPTS, "enrich.ts"),
      "--niche", niche,
      "--all-pending",
      ...dry, ...quiet,
    ]);
  } else {
    console.log("⏭️  Enrichment preskočený (--skip-enrich)");
  }

  // ── FÁZA 3: Validate (vždy) ───────────────────────────────────────────────
  step("Validácia / Scoring", [
    join(SCRIPTS, "validate.ts"),
    "--niche", niche,
    "--min-score", args["min-score"] as string,
  ]);

  // ── FÁZA 4: Inject ────────────────────────────────────────────────────────
  if (!args["skip-inject"]) {
    step("Inject do Smartleadu", [
      join(SCRIPTS, "inject.ts"),
      "--niche", niche,
      "--min-score", args["min-score"] as string,
      ...(args["create-campaign"] ? ["--create-campaign"] : []),
      ...(args["use-ai-sequences"] ? ["--use-ai-sequences"] : []),
      ...dry, ...quiet,
    ]);
  } else {
    console.log("⏭️  Inject preskočený (--skip-inject)");
  }

  // ── FÁZA 5: DB Status ─────────────────────────────────────────────────────
  step("DB Status (záverečný prehľad)", [
    join(SCRIPTS, "db-status.ts"),
    "--niche", niche,
  ]);

  const elapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1);
  console.log(`\n${"█".repeat(60)}`);
  console.log(`  ✅ PIPELINE DOKONČENÁ — ${elapsed}s`);
  console.log(`  Niche: ${niche} | DryRun: ${args["dry-run"] ?? false}`);
  console.log(`${"█".repeat(60)}\n`);
}

main().catch(e => {
  console.error("❌ Kritická chyba:", e.message);
  process.exit(1);
});
