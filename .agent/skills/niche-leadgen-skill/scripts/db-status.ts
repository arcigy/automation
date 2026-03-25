#!/usr/bin/env bun
/**
 * scripts/db-status.ts
 * Prehľad stavu databázy — počty leadov, enriched, Smartlead.
 *
 * Použitie:
 *   bun scripts/db-status.ts
 *   bun scripts/db-status.ts --niche stavebniny   (iba jedna niche)
 */

import { getConfig } from "../config";
import postgres from "postgres";
import { parseArgs } from "util";

const { values: args } = parseArgs({
  args: (typeof Bun !== "undefined" ? Bun.argv : process.argv).slice(2),
  options: {
    niche: { type: "string" },
  },
  strict: false,
});

async function main() {
  const cfg = getConfig();
  const sql = postgres(cfg.DATABASE_URL);

  const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
  console.log(`\n📊 DB Status (${now})\n`);

  // ─── Per-niche stats ──────────────────────────────────────────────────────
  const rows = await sql<{
    niche_slug: string;
    total: number;
    enriched: number;
    in_smartlead: number;
    verified: number;
    avg_score: number | null;
  }[]>`
    SELECT
      l.campaign_tag AS niche_slug,
      COUNT(*)::int AS total,
      COUNT(CASE WHEN l.primary_email IS NOT NULL THEN 1 END)::int AS enriched,
      COUNT(CASE WHEN l.sent_to_smartlead = true THEN 1 END)::int AS in_smartlead,
      COUNT(CASE WHEN l.verification_status = 'verified' THEN 1 END)::int AS verified,
      NULL::float AS avg_score
    FROM leads l
    ${args.niche ? sql`WHERE l.campaign_tag = ${args.niche as string}` : sql``}
    GROUP BY l.campaign_tag
    ORDER BY total DESC
  `;

  if (rows.length === 0) {
    console.log("  (žiadne dáta v DB)\n");
    await sql.end();
    return;
  }

  // ─── Table header ──────────────────────────────────────────────────────────
  const col = (s: string | number, w: number) => String(s).padEnd(w);
  const line = "─".repeat(75);
  console.log(line);
  console.log(
    `${col("Niche", 22)} ${col("Total", 8)} ${col("Enriched", 10)} ${col("InSmartld", 10)} ${col("Verified", 10)} ${col("Score", 7)}`
  );
  console.log(line);

  let sumTotal = 0, sumEnriched = 0, sumSL = 0, sumVerified = 0;
  for (const r of rows) {
    const pctEnriched = r.total > 0 ? Math.round((r.enriched / r.total) * 100) : 0;
    sumTotal += r.total; sumEnriched += r.enriched; sumSL += r.in_smartlead; sumVerified += r.verified;
    console.log(
      `${col(r.niche_slug || "(bez niche)", 22)} ${col(r.total, 8)} ${col(`${r.enriched} (${pctEnriched}%)`, 10)} ${col(r.in_smartlead, 10)} ${col(r.verified, 10)} ${col(r.avg_score !== null ? String(Math.round(r.avg_score)) : "–", 7)}`
    );
  }

  console.log(line);
  const totalPct = sumTotal > 0 ? Math.round((sumEnriched / sumTotal) * 100) : 0;
  console.log(`${col("TOTAL", 22)} ${col(sumTotal, 8)} ${col(`${sumEnriched} (${totalPct}%)`, 10)} ${col(sumSL, 10)} ${col(sumVerified, 10)}`);
  console.log(line);

  // ─── Extra stats ───────────────────────────────────────────────────────────
  const bRaw = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM domain_blacklist`;
  const blCount = bRaw[0]?.count ?? 0;

  const pendingRaw = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM leads WHERE primary_email IS NULL AND verification_status IS NULL
  `;
  const pending = pendingRaw[0]?.count ?? 0;

  console.log(`\n  Blacklist domén  : ${blCount}`);
  console.log(`  Čakajú na enrich : ${pending}`);
  console.log();

  // ─── Resume check ──────────────────────────────────────────────────────────
  try {
    const rs = await sql<{ key: string; value: { region_index?: number } }[]>`SELECT key, value FROM resume_state`;
    if (rs.length > 0) {
      console.log("  ⏸️  Prerušené behy (--resume na pokračovanie):");
      for (const r of rs) console.log(`    ${r.key} → región #${r.value.region_index}`);
      console.log();
    }
  } catch { /* ignore if table doesn't exist */ }

  await sql.end();
}

main().catch(e => {
  console.error("❌ Kritická chyba:", e.message);
  process.exit(1);
});
