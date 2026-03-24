#!/usr/bin/env bun
/**
 * scripts/validate.ts
 * Skóruje leady z DB podľa pravidiel z references/scoring-rules.md.
 * Používa sa pred inject.ts na filtráciu nekvalitných leadov.
 *
 * Použitie:
 *   bun scripts/validate.ts --niche "stavebniny"
 *   bun scripts/validate.ts --niche "stavebniny" --min-score 70
 */

import { getConfig } from "../config";
import postgres from "postgres";
import { parseArgs } from "util";

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    niche:       { type: "string" },
    "min-score": { type: "string", default: "0" },
    verbose:     { type: "boolean", default: false },
  },
  strict: false,
});

// ─── Scoring Rules ────────────────────────────────────────────────────────────
// Zrkadlí references/scoring-rules.md
function scoreLead(lead: {
  primary_email?: string | null;
  website?: string | null;
  decision_maker_name?: string | null;
  verification_status?: string | null;
  orsr_verified?: boolean;
  icebreaker_sentence?: string | null;
}): { score: number; breakdown: string[] } {
  let score = 0;
  const breakdown: string[] = [];

  if (lead.primary_email) {
    // Penalizácia za generické emaily
    if (/^(info|kontakt|office|admin|mail|hello)@/i.test(lead.primary_email)) {
      score -= 20; breakdown.push("−20: email je generický (info@, kontakt@...)");
    } else {
      score += 30; breakdown.push("+30: má osobný email");
    }
  } else {
    score -= 10; breakdown.push("−10: chýba email");
  }

  if (lead.website) {
    score += 20; breakdown.push("+20: má web");
    if (lead.website.endsWith(".sk")) { score += 10; breakdown.push("+10: doména .sk"); }
  }

  if (lead.decision_maker_name) { score += 25; breakdown.push("+25: má decision maker"); }

  if (lead.verification_status === "verified") { score += 15; breakdown.push("+15: ORSR overený"); }
  else if (lead.verification_status === "flagged") { score -= 15; breakdown.push("−15: flagged"); }
  else if (lead.verification_status === "failed") { score -= 30; breakdown.push("−30: verification failed"); }

  if (lead.icebreaker_sentence) { score += 10; breakdown.push("+10: má icebreaker"); }

  return { score: Math.max(0, Math.min(100, score)), breakdown };
}

async function main() {
  const cfg = getConfig();
  const sql = postgres(cfg.DATABASE_URL);
  const minScore = parseInt(args["min-score"] as string ?? "0", 10);

  const where = args.niche
    ? sql`WHERE campaign_tag = ${args.niche as string} AND sent_to_smartlead = false`
    : sql`WHERE sent_to_smartlead = false`;

  const leads = await sql<{
    id: string;
    website: string;
    primary_email?: string | null;
    decision_maker_name?: string | null;
    verification_status?: string | null;
    icebreaker_sentence?: string | null;
    orsr_verified?: boolean;
  }[]>`SELECT id, website, primary_email, decision_maker_name, verification_status, icebreaker_sentence, orsr_verified FROM leads ${where}`;

  if (leads.length === 0) {
    console.log("⚠️  Žiadne leady na validáciu.");
    await sql.end();
    return;
  }

  const buckets: Record<string, number[]> = { "0-29": [], "30-49": [], "50-69": [], "70-89": [], "90-100": [] };
  let passCount = 0;
  let failCount = 0;

  for (const lead of leads) {
    const { score, breakdown } = scoreLead(lead);

    const bucket = score < 30 ? "0-29" : score < 50 ? "30-49" : score < 70 ? "50-69" : score < 90 ? "70-89" : "90-100";
    buckets[bucket].push(score);

    if (score >= minScore) passCount++; else failCount++;

    if (args.verbose) {
      console.log(`\n  ${lead.website} [skóre: ${score}]`);
      breakdown.forEach(b => console.log(`    ${b}`));
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n📊 Scoring výsledky (${args.niche ?? "všetky niche"}) — min-score: ${minScore}`);
  console.log("─".repeat(45));
  const all = Object.values(buckets).flat();
  const avg = all.length > 0 ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0;
  console.log(`  Priemer skóre  : ${avg}/100`);
  console.log(`  Celkom leadov  : ${leads.length}`);
  console.log(`  Prejde (≥${minScore}) : ${passCount} (${Math.round((passCount / leads.length) * 100)}%)`);
  console.log(`  Neprejde (<${minScore}): ${failCount}`);
  console.log("\n  Rozdelenie:");
  for (const [range, scores] of Object.entries(buckets)) {
    const bar = "█".repeat(Math.round(scores.length / leads.length * 30));
    console.log(`    ${range.padEnd(8)} ${bar} ${scores.length}`);
  }
  console.log("─".repeat(45));
  if (minScore > 0) {
    console.log(`\n💡 Tip: bun scripts/inject.ts --niche ${args.niche ?? "[niche]"} --min-score ${minScore}`);
  }
  console.log();

  await sql.end();
}

main().catch(e => {
  console.error("❌ Kritická chyba:", e.message);
  process.exit(1);
});
