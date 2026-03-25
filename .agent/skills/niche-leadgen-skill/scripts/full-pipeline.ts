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
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const { values: args } = parseArgs({
  args: (typeof Bun !== "undefined" ? Bun.argv : process.argv).slice(2),
  options: {
    niche:              { type: "string" },
    query:              { type: "string" },
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

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)));

function step(name: string, scriptPath: string, argsList: string[]) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🚀 FÁZA: ${name}`);
  console.log(`   Príkaz: node --env-file=.env --import tsx ${scriptPath} ${argsList.join(" ")}`);
  console.log(`${"═".repeat(60)}`);

  const result = spawnSync("node", ["--env-file=.env", "--import", "tsx", scriptPath, ...argsList], { 
    stdio: "inherit", 
    cwd: process.cwd() 
  });
  
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
    const discArgs = [
      "--niche", niche,
      "--region", args.region as string,
      "--source", args.source as string,
      "--target", args.target as string,
      "--resume",
      ...dry, ...quiet,
    ];
    if (args.query) discArgs.push("--query", args.query as string);

    step("Discovery", join(SCRIPTS, "discovery.ts"), discArgs);
  }

  // ── FÁZA 2: Enrichment ────────────────────────────────────────────────────
  if (!args["skip-enrich"]) {
    step("Enrichment", join(SCRIPTS, "enrich.ts"), [
      "--niche", niche,
      "--all-pending",
      ...dry, ...quiet,
    ]);
  }

  // ── FÁZA 3: Validate (vždy) ───────────────────────────────────────────────
  step("Validácia / Scoring", join(SCRIPTS, "validate.ts"), [
    "--niche", niche,
    "--min-score", args["min-score"] as string,
  ]);

  // ── FÁZA 4: Inject ────────────────────────────────────────────────────────
  if (!args["skip-inject"]) {
    step("Inject do Smartleadu", join(SCRIPTS, "inject.ts"), [
      "--niche", niche,
      "--min-score", args["min-score"] as string,
      ...(args["create-campaign"] ? ["--create-campaign"] : []),
      ...(args["use-ai-sequences"] ? ["--use-ai-sequences"] : []),
      ...dry, ...quiet,
    ]);
  }

  // ── FÁZA 5: DB Status ─────────────────────────────────────────────────────
  step("DB Status (záverečný prehľad)", join(SCRIPTS, "db-status.ts"), [
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
