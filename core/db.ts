import postgres from "postgres";
import { env } from "./env";

export const sql = postgres(env.DATABASE_URL);

/**
 * Synchronizes the database schema with the required state.
 * This function should match the actual structure used by the handlers.
 */
export async function runMigrations() {
  console.log("🛠️ Spúšťam synchronizáciu databázy...");

  // 1. Automation Logs
  await sql`
    CREATE TABLE IF NOT EXISTS automation_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID NOT NULL,
      automation_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('success', 'error')),
      payload JSONB,
      result JSONB,
      error TEXT,
      duration_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_logs_automation_created ON automation_logs (automation_name, created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_logs_status_created ON automation_logs (status, created_at DESC);`;

  // 2. Niches
  await sql`
    CREATE TABLE IF NOT EXISTS niches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      tier INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      keywords TEXT[] DEFAULT '{}',
      regions TEXT[] DEFAULT '{}',
      current_region_index INTEGER DEFAULT 0,
      daily_target INTEGER DEFAULT 120,
      smartlead_campaign_id TEXT,
      last_worked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // 3. Leads
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      website TEXT UNIQUE NOT NULL,
      original_name TEXT,
      company_name_short TEXT,
      official_company_name TEXT,
      decision_maker_name TEXT,
      decision_maker_last_name TEXT,
      primary_email TEXT,
      phone TEXT,
      ico TEXT,
      address TEXT,
      business_facts JSONB,
      icebreaker_sentence TEXT,
      stakeholders JSONB,
      source TEXT,
      campaign_tag TEXT,
      verification_status TEXT,
      verification_notes TEXT,
      orsr_verified BOOLEAN DEFAULT false,
      manually_reviewed BOOLEAN DEFAULT false,
      sent_to_smartlead BOOLEAN DEFAULT false,
      smartlead_contact_id TEXT,
      reply_status TEXT,
      reply_sentiment TEXT,
      niche_id UUID REFERENCES niches(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_website ON leads (website);`;

  // 4. Niche Stats
  await sql`
    CREATE TABLE IF NOT EXISTS niche_stats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      niche_id UUID NOT NULL REFERENCES niches(id),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      discovered INTEGER DEFAULT 0,
      enriched INTEGER DEFAULT 0,
      qualified INTEGER DEFAULT 0,
      sent_to_smartlead INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(niche_id, date)
    );
  `;

  // 5. Sent Replies
  await sql`
    CREATE TABLE IF NOT EXISTS sent_replies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_email TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(lead_email, campaign_id)
    );
  `;

  // 6. System Settings (Control Switch)
  await sql`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value BOOLEAN DEFAULT true,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // 7. Processed Gmail Messages (For Polling)
  await sql`
    CREATE TABLE IF NOT EXISTS processed_gmail_messages (
      message_id TEXT PRIMARY KEY,
      processed_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // Initial values
  await sql`INSERT INTO system_settings (key, value) VALUES ('leadgen_active', true) ON CONFLICT (key) DO NOTHING;`;
  await sql`INSERT INTO system_settings (key, value) VALUES ('ai_replies_active', true) ON CONFLICT (key) DO NOTHING;`;

  console.log("✅ Databáza je synchronizovaná.");
}

export async function isSystemActive(key: string): Promise<boolean> {
  try {
    const result = await sql`SELECT value FROM system_settings WHERE key = ${key}`;
    return result.length > 0 ? result[0].value : true;
  } catch (e) {
    return true; // Fallback to active if table doesn't exist yet
  }
}
