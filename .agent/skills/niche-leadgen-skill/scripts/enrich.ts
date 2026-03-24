#!/usr/bin/env bun
/**
 * scripts/enrich.ts
 * Lead Enrichment — scrape webov, extrakcia emailu, decision maker, AI icebreaker.
 * Volá existujúci lead-enricher handler v automations/.
 *
 * Použitie:
 *   bun scripts/enrich.ts --all-pending
 *   bun scripts/enrich.ts --niche "stavebniny" --limit 50
 *   bun scripts/enrich.ts --niche "realitky" --dry-run
 */

import { getConfig } from "../config";
import postgres from "postgres";
import { parseArgs } from "util";

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    niche:         { type: "string" },
    limit:         { type: "string", default: "50" },
    "all-pending": { type: "boolean", default: false },
    "dry-run":     { type: "boolean", default: false },
    verbose:       { type: "boolean", default: false },
    quiet:         { type: "boolean", default: false },
  },
  strict: false,
});

type LogLevel = "info" | "ok" | "warn" | "err" | "skip" | "data";
function log(level: LogLevel, msg: string) {
  if (args.quiet && level !== "err" && level !== "data") return;
  const icons: Record<LogLevel, string> = { info: "🔍", ok: "✅", warn: "⚠️ ", err: "❌", skip: "⏭️ ", data: "📊" };
  console.log(`${icons[level]} ${msg}`);
}

async function main() {
  const cfg = getConfig();
  const sql = postgres(cfg.DATABASE_URL);
  const limit = parseInt(args.limit as string, 10);
  const isDryRun = args["dry-run"] as boolean;

  // ─── Načítaj leady na enrich ───────────────────────────────────────────────
  let whereConditions = ["l.primary_email IS NULL", "l.verification_status IS NULL"];
  if (args.niche) whereConditions.push(`l.campaign_tag = '${(args.niche as string).replace(/'/g, "''")}'`);

  const leads = await sql.unsafe<Array<{
    id: string; website: string; original_name: string | null;
  }>>(`
    SELECT id, website, original_name
    FROM leads l
    WHERE ${whereConditions.join(" AND ")}
    ORDER BY l.created_at ASC
    LIMIT ${limit}
  `);

  if (leads.length === 0) {
    log("info", "Žiadne leady čakajú na enrichment.");
    await sql.end();
    return;
  }

  log("info", `[ENRICH] ${leads.length} leadov na spracovanie | Limit: ${limit} | DryRun: ${isDryRun}`);

  let ok = 0, failed = 0, noEmail = 0;
  const startTime = Date.now();

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const progress = `[${i + 1}/${leads.length}]`;

    if (isDryRun) {
      log("info", `${progress} DRY-RUN: ${lead.website}`);
      ok++;
      continue;
    }

    try {
      // ── Volanie lead-enricher handlera priamo ─────────────────────────────
      // Importujeme handler z project root aby sme nezduplikovali logiku
      const PROJECT_ROOT = new URL("../../../", import.meta.url).pathname;
      const { handler } = await import(`${PROJECT_ROOT}automations/lead-enricher/handler.ts`);

      const result = await handler({
        leads: [{ name: lead.original_name ?? lead.website, website: lead.website }],
        aggressive_scraping: true,
      });

      if (result.success && result.data?.leads?.length > 0) {
        const enriched = result.data.leads[0];
        if (enriched.email) {
          log("ok", `${progress} ${lead.website} → ${enriched.email} | DM: ${enriched.decision_maker_name ?? "–"}`);
          ok++;
        } else {
          log("warn", `${progress} ${lead.website} → Email nenájdený`);
          noEmail++;
        }
      } else {
        log("skip", `${progress} ${lead.website} → Enrichment zlyhalo`);
        failed++;
      }
    } catch (e: any) {
      log("err", `${progress} ${lead.website} → ${e.message}`);
      failed++;
    }

    // Krátka pauza medzi requestmi
    await new Promise(r => setTimeout(r, 300));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"═".repeat(50)}`);
  log("data", `ENRICH HOTOVO (${elapsed}s)`);
  log("data", `  Úspešných  : ${ok}  (${Math.round((ok / leads.length) * 100)}%)`);
  log("data", `  Bez emailu : ${noEmail}`);
  log("data", `  Zlyhalo    : ${failed}`);
  console.log(`${"═".repeat(50)}\n`);

  await sql.end();
}

main().catch(e => {
  console.error("❌ Kritická chyba:", e.message);
  process.exit(1);
});
