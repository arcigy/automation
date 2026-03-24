#!/usr/bin/env bun
/**
 * scripts/blacklist.ts
 * Správa blacklistu domén v DB.
 *
 * Použitie:
 *   bun scripts/blacklist.ts --add "konkurencia.sk"
 *   bun scripts/blacklist.ts --add "firma.sk" --reason "Konkurencia"
 *   bun scripts/blacklist.ts --list
 *   bun scripts/blacklist.ts --remove "firma.sk"
 */

import { getConfig } from "../config";
import postgres from "postgres";
import { parseArgs } from "util";

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    add:    { type: "string" },
    remove: { type: "string" },
    list:   { type: "boolean", default: false },
    reason: { type: "string", default: "" },
  },
  strict: false,
});

async function ensureTable(sql: ReturnType<typeof postgres>) {
  await sql`
    CREATE TABLE IF NOT EXISTS domain_blacklist (
      domain TEXT PRIMARY KEY,
      reason TEXT,
      added_at TIMESTAMPTZ DEFAULT now()
    )
  `;
}

async function main() {
  const cfg = getConfig();
  const sql = postgres(cfg.DATABASE_URL);

  await ensureTable(sql);

  if (args.add) {
    const domain = (args.add as string).toLowerCase().replace(/^https?:\/\/(www\.)?/, "").split("/")[0].trim();
    await sql`
      INSERT INTO domain_blacklist (domain, reason)
      VALUES (${domain}, ${args.reason as string || null})
      ON CONFLICT (domain) DO UPDATE SET reason = EXCLUDED.reason
    `;
    console.log(`✅ Pridané na blacklist: ${domain}${args.reason ? ` (${args.reason})` : ""}`);
  }

  else if (args.remove) {
    const domain = (args.remove as string).toLowerCase().replace(/^https?:\/\/(www\.)?/, "").split("/")[0].trim();
    const result = await sql`DELETE FROM domain_blacklist WHERE domain = ${domain} RETURNING domain`;
    if (result.length > 0) {
      console.log(`✅ Odstránené z blacklistu: ${domain}`);
    } else {
      console.log(`⚠️  "${domain}" sa na blackliste nenachádza.`);
    }
  }

  else if (args.list) {
    const rows = await sql<{ domain: string; reason: string | null; added_at: Date }[]>`
      SELECT domain, reason, added_at FROM domain_blacklist ORDER BY added_at DESC
    `;
    if (rows.length === 0) {
      console.log("📋 Blacklist je prázdny.");
    } else {
      console.log(`\n📋 Blacklist (${rows.length} domén):`);
      console.log("─".repeat(60));
      for (const row of rows) {
        const date = row.added_at.toISOString().split("T")[0];
        const reason = row.reason ? ` — ${row.reason}` : "";
        console.log(`  ${row.domain.padEnd(40)} [${date}]${reason}`);
      }
      console.log("─".repeat(60));
    }
  }

  else {
    console.error("❌ Zadaj jeden z flagov: --add, --remove, --list");
    console.error("   Príklady:");
    console.error('   bun scripts/blacklist.ts --add "konkurencia.sk" --reason "Konkurencia"');
    console.error('   bun scripts/blacklist.ts --list');
    console.error('   bun scripts/blacklist.ts --remove "firma.sk"');
    process.exit(1);
  }

  await sql.end();
}

main().catch(e => {
  console.error("❌ Kritická chyba:", e.message);
  process.exit(1);
});
