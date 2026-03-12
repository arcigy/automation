import { Hono } from "hono";
import { sql } from "../../core/db";
import { ok, err } from "../../core/response";
import { scrapeLeadDetails } from "../helpers/fast-scrape";

const crm = new Hono();

// Získať všetky niches
crm.get("/niches", async (c) => {
  try {
    const niches = await sql`SELECT id, name, slug FROM niches ORDER BY name ASC`;
    return ok(c, niches);
  } catch (e: any) {
    return err(c, e.message);
  }
});

// Získať leads pre konkrétnu niche
crm.get("/leads/:nicheId", async (c) => {
  const nicheId = c.req.param("nicheId");
  try {
    const leads = await sql`
      SELECT 
        id, website, original_name, company_name_short, 
        decision_maker_name, decision_maker_last_name, primary_email, phone, 
        icebreaker_sentence, verification_status, sent_to_smartlead,
        ico, official_company_name
      FROM leads 
      WHERE niche_id = ${nicheId}
      ORDER BY created_at DESC
    `;
    return ok(c, leads);
  } catch (e: any) {
    return err(c, e.message);
  }
});

// Aktualizovať lead (napr. cez click-to-paste)
crm.patch("/leads/:leadId", async (c) => {
  const leadId = c.req.param("leadId");
  const body = await c.req.json();

  try {
    // Dynamicky vytvoríme update query podľa toho čo prišlo v body
    const allowedFields = ['decision_maker_name', 'decision_maker_last_name', 'primary_email', 'phone', 'icebreaker_sentence', 'company_name_short', 'ico', 'official_company_name'];
    const updates: Record<string, any> = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) return err(c, "No valid fields to update");

    await sql`
      UPDATE leads 
      SET ${sql(updates)}, updated_at = now()
      WHERE id = ${leadId}
    `;

    // Ak sa zmenilo IČO alebo Názov, spusti bleskový scrape
    if (updates.ico || updates.official_company_name) {
      scrapeLeadDetails(leadId).catch(e => console.error("Fast scrape failed:", e));
    }

    return ok(c, { success: true });
  } catch (e: any) {
    return err(c, e.message);
  }
});

// Vymazať lead
crm.delete("/leads/:leadId", async (c) => {
  const leadId = c.req.param("leadId");
  try {
    await sql`DELETE FROM leads WHERE id = ${leadId}`;
    return ok(c, { success: true });
  } catch (e: any) {
    return err(c, e.message);
  }
});

export { crm as crmRoutes };
