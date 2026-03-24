/**
 * config.ts — Single source of truth pre ENV premenné.
 * Každý skript importuje loadConfig() a nikdy nepoužíva process.env priamo.
 * Ak chýba akýkoľvek kľúč → okamžite process.exit(1) s jasnou správou.
 */

const REQUIRED_VARS = {
  DATABASE_URL: process.env.DATABASE_URL,
  SMARTLEAD_API_KEY: process.env.SMARTLEAD_API_KEY,
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  SERPER_API_KEY: process.env.SERPER_API_KEY,
} as const;

// AI obsah (icebreakers, sekvencie) generuje Gemini Flash 2.5 — GEMINI_API_KEY je voliteľný.

// Optional vars (nenastavia chybu, len warning)
const OPTIONAL_VARS = {
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY, // Gemini Flash 2.5 for AI generation
};

export type Config = Record<keyof typeof REQUIRED_VARS, string> & {
  SLACK_WEBHOOK_URL?: string;
  GEMINI_API_KEY?: string;
};

export function loadConfig(): Config {
  const missing = Object.entries(REQUIRED_VARS)
    .filter(([, v]) => !v || v.trim() === "")
    .map(([k]) => k);

  if (missing.length > 0) {
    console.error("\n❌ CHYBA: Chýbajú povinné ENV premenné:");
    missing.forEach((k) => console.error(`   • ${k}`));
    console.error("\n💡 Riešenie:");
    console.error("   1. Skontroluj .env súbor v project roote");
    console.error("   2. Pozri references/setup.md pre návod");
    console.error("   3. Skopíruj .env.example a vyplň hodnoty\n");
    process.exit(1);
  }

  const optional = Object.fromEntries(
    Object.entries(OPTIONAL_VARS).filter(([, v]) => v && v.trim() !== "")
  );

  if (!OPTIONAL_VARS.SLACK_WEBHOOK_URL) {
    console.warn("⚠️  SLACK_WEBHOOK_URL nie je nastavený — Slack notifikácie budú vypnuté.");
  }

  return {
    ...(REQUIRED_VARS as Record<keyof typeof REQUIRED_VARS, string>),
    ...optional,
  };
}

// Singleton — načíta sa raz, zdieľa sa cez import
let _config: Config | null = null;
export function getConfig(): Config {
  if (!_config) _config = loadConfig();
  return _config;
}
