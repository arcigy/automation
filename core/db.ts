import postgres from "postgres";
import { env } from "./env";

export const sql = postgres(env.DATABASE_URL);

export async function runMigrations() {
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
  await sql`
    CREATE INDEX IF NOT EXISTS idx_logs_automation_created
      ON automation_logs (automation_name, created_at DESC);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_logs_status_created
      ON automation_logs (status, created_at DESC);
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sent_replies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_email TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(lead_email, campaign_id)
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_sent_replies_lead_campaign 
      ON sent_replies (lead_email, campaign_id);
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      website TEXT UNIQUE NOT NULL,
      original_name TEXT,
      company_name_short TEXT,
      decision_maker_name TEXT,
      primary_email TEXT,
      business_facts JSONB,
      verification_status TEXT,
      verification_notes TEXT,
      source TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_leads_website ON leads (website);
  `;
  console.log("Migrations applied successfully.");
}
