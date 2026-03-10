import { inputSchema, type Input, type Output, type EnrichedLead } from "./schema";
import { logRun } from "../../core/logger";
import { sql } from "../../core/db";
import type { AutomationResult } from "../../core/types";
import { randomUUID } from "crypto";
import { webScraperTool } from "../../tools/scraping/web-scraper.tool";
import { geminiCallTool } from "../../tools/ai/gemini-call.tool";

export async function handler(
  rawInput: unknown,
): Promise<AutomationResult<Output>> {
  const ctx = {
    automationName: "lead-enricher",
    runId: randomUUID(),
    startTime: Date.now(),
  };

  const input = inputSchema.parse(rawInput);
  
  // 1. Deduplicate by domain
  const uniqueDomainLeads = Array.from(new Map(
    input.leads.map(l => {
        try {
            const domain = new URL(l.website).hostname.replace("www.", "");
            return [domain, l];
        } catch (e) {
            return [l.website, l];
        }
    })
  ).values());

  const enrichedLeads: EnrichedLead[] = [];

  try {
    for (const lead of uniqueDomainLeads) {
      console.log(`Enriching lead: ${lead.website}`);
      
      // 2. Aggressive Scrape
      const scrapeResults = await webScraperTool({ url: lead.website, depth: 1 });
      const combinedText = scrapeResults.map(r => `--- PAGE: ${r.url} ---\n${r.text}`).join("\n\n");
      const allEmails = [...new Set(scrapeResults.flatMap(r => r.emails))];

      // 3. AI Extraction & Verification
      const systemPrompt = `You are a professional lead researcher. Your goal is to extract clinical/business data from scaped website text.
      
      RULES:
      1. Identify the Name of the Decision Maker (Owner, CEO, Doctor, Founder).
      2. Identify a few "Business Facts" that could be used for a personal compliment (e.g., specialized equipment, years of experience, specific awards, unique services).
      3. Verify the Name: If you find multiple different names or just generic staff lists, pick the most senior one. If unsure, flag it.
      4. Create a "company_name_short": A short, conversational version of the business name. Remove legal suffixes (s.r.o., a.s., company, inc), prefixes like 'www', or any generic overly long descriptors. If the original name is a generic agglomeration of words, look at the domain name to guess the brand name. It should sound natural in an email like "Ahoj [company_name_short],".
      
      RETURN JSON FORMAT:
      {
        "decision_maker_name": "string or null",
        "company_name_short": "string",
        "business_facts": ["fact 1", "fact 2"],
        "verification_status": "verified" | "flagged",
        "verification_notes": "why it was flagged or why it is certain"
      }`;

      const userMessage = `Original Name: ${lead.name}\nWebsite Domain: ${lead.website}\n\nWebsite Content:\n\n${combinedText.substring(0, 15000)}`;

      const aiRes = await geminiCallTool({
        systemPrompt,
        userMessage,
        maxTokens: 1000,
        model: "gemini-2.5-flash"
      });

      try {
        const cleanedContent = aiRes.content.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanedContent);
        
        const enrichedObj: EnrichedLead = {
          original_name: lead.name,
          company_name_short: parsed.company_name_short || lead.name,
          website: lead.website,
          decision_maker_name: parsed.decision_maker_name,
          email: allEmails[0], // Take the first found email as primary
          business_facts: parsed.business_facts || [],
          verification_status: parsed.verification_status || "flagged",
          verification_notes: parsed.verification_notes
        };
        enrichedLeads.push(enrichedObj);

        // Save progress to DB immediately ("zapochodu")
        try {
          await sql`
            INSERT INTO leads (
              website, original_name, company_name_short, decision_maker_name, 
              primary_email, business_facts, verification_status, verification_notes, updated_at
            ) VALUES (
              ${enrichedObj.website},
              ${enrichedObj.original_name},
              ${enrichedObj.company_name_short},
              ${enrichedObj.decision_maker_name || null},
              ${enrichedObj.email || null},
              ${sql.json(enrichedObj.business_facts)},
              ${enrichedObj.verification_status},
              ${enrichedObj.verification_notes || null},
              now()
            )
            ON CONFLICT (website) DO UPDATE SET
              original_name = EXCLUDED.original_name,
              company_name_short = EXCLUDED.company_name_short,
              decision_maker_name = EXCLUDED.decision_maker_name,
              primary_email = EXCLUDED.primary_email,
              business_facts = EXCLUDED.business_facts,
              verification_status = EXCLUDED.verification_status,
              verification_notes = EXCLUDED.verification_notes,
              updated_at = EXCLUDED.updated_at;
          `;
        } catch (dbErr) {
          console.error(`Failed to save lead ${lead.website} to DB:`, dbErr);
        }
      } catch (e) {
        console.error(`Detailed AI parsing error for ${lead.website}:`, e);
        console.error(`RAW AI OUTPUT:`, aiRes.content);
        
        const failedObj: EnrichedLead = {
          original_name: lead.name,
          company_name_short: lead.name,
          website: lead.website,
          business_facts: [],
          verification_status: "failed",
          verification_notes: "Could not parse AI response"
        };
        enrichedLeads.push(failedObj);

        try {
          await sql`
            INSERT INTO leads (
              website, original_name, company_name_short,
              business_facts, verification_status, verification_notes, updated_at
            ) VALUES (
              ${failedObj.website},
              ${failedObj.original_name},
              ${failedObj.company_name_short},
              ${sql.json(failedObj.business_facts)},
              ${failedObj.verification_status},
              ${failedObj.verification_notes || null},
              now()
            )
            ON CONFLICT (website) DO UPDATE SET
              verification_status = EXCLUDED.verification_status,
              verification_notes = EXCLUDED.verification_notes,
              updated_at = EXCLUDED.updated_at;
          `;
        } catch (dbErr) {
          console.error(`Failed to save failed-lead ${lead.website} to DB:`, dbErr);
        }
      }
    }

    const result: AutomationResult<Output> = {
      success: true,
      data: {
        leads: enrichedLeads
      },
      durationMs: Date.now() - ctx.startTime,
    };

    await logRun(ctx, result, input);
    return result;
  } catch (error: any) {
    const result: AutomationResult<Output> = {
      success: false,
      error: error.message,
      durationMs: Date.now() - ctx.startTime,
    };
    await logRun(ctx, result, input);
    throw error;
  }
}
