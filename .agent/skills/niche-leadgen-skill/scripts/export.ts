#!/usr/bin/env bun
/**
 * scripts/export.ts
 * CSV export leadov z DB pre manuálny review pred Smartlead inject-om.
 *
 * Použitie:
 *   bun scripts/export.ts --niche "stavebniny" --output ./export.csv
 *   bun scripts/export.ts --status enriched --output ./all-enriched.csv
 *   bun scripts/export.ts --status all --niche "realitky"
 */

import { getConfig } from "../config";
import postgres from "postgres";
import { parseArgs } from "util";
import { writeFileSync } from "fs";

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    niche:   { type: "string" },
    status:  { type: "string", default: "enriched" },  // enriched | all | pending | sent
    output:  { type: "string" },
  },
  strict: false,
});

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toRow(obj: Record<string, unknown>): string {
  return Object.values(obj).map(csvEscape).join(",");
}

async function main() {
  const cfg = getConfig();
  const sql = postgres(cfg.DATABASE_URL);

  const conditions: string[] = [];
  if (args.niche) conditions.push(`campaign_tag = '${(args.niche as string).replace(/'/g, "''")}'`);

  const status = (args.status as string) ?? "enriched";
  if (status === "enriched") conditions.push("primary_email IS NOT NULL");
  else if (status === "pending") conditions.push("primary_email IS NULL AND verification_status IS NULL");
  else if (status === "sent") conditions.push("sent_to_smartlead = true");
  // "all" → no extra filter

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const leads = await sql.unsafe<Array<Record<string, unknown>>>(`
    SELECT
      website,
      original_name,
      official_company_name AS company_name,
      decision_maker_name,
      decision_maker_last_name,
      primary_email AS email,
      phone,
      ico,
      address,
      icebreaker_sentence,
      campaign_tag AS niche,
      verification_status,
      sent_to_smartlead,
      created_at
    FROM leads
    ${whereClause}
    ORDER BY created_at DESC
  `);

  if (leads.length === 0) {
    console.log(`⚠️  Žiadne leady pre status="${status}"${args.niche ? ` niche="${args.niche}"` : ""}`);
    await sql.end();
    return;
  }

  const headers = Object.keys(leads[0]);
  const csvLines = [
    headers.join(","),
    ...leads.map(l => toRow(l)),
  ];
  const csvContent = csvLines.join("\n");

  const outPath = (args.output as string) ?? `./export-${args.niche ?? "all"}-${Date.now()}.csv`;
  writeFileSync(outPath, csvContent, "utf-8");

  console.log(`✅ Exportované: ${leads.length} leadov → ${outPath}`);
  console.log(`   Status filter: ${status} | Niche: ${args.niche ?? "všetky"}`);

  await sql.end();
}

main().catch(e => {
  console.error("❌ Kritická chyba:", e.message);
  process.exit(1);
});
