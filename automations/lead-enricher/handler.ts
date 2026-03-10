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
      const systemPrompt = `You are a professional lead researcher and expert B2B copywriter. Your goal is to extract business data and write a WARM, AUTHENTIC personal compliment.
      
      RULES:
      1. Identify the Full Name of the Decision Maker (Owner, CEO, Doctor, Founder).
      2. Identify the Last Name (Priezvisko) of the Decision Maker specifically.
      3. Identify a few "Business Facts" for a personal compliment.
      4. Verify the Name: Pick the most senior. If unsure, flag it.
      5. Create a "company_name_short": Conversational version (e.g., "Homola", "S-Autoservis").
      6. Write an "icebreaker_sentence": A warm, human, and professional compliment in SLOVAK.
         - Format: "Naozaj ma zaujalo, že [Fakt] – v dnešnej dobe je [hodnota]."
      
      CRITICAL: RETURN ONLY VALID JSON.
      
      EXPECTED JSON FORMAT:
      {
        "decision_maker_full_name": "string or null",
        "decision_maker_last_name": "string or null",
        "company_name_short": "string",
        "business_facts": ["fact 1", "fact 2"],
        "icebreaker_sentence": "sentence in Slovak",
        "verification_status": "verified" | "flagged",
        "verification_notes": "why it was flagged"
      }`;

      const userMessage = `Original Name: ${lead.name}\nWebsite Domain: ${lead.website}\n\nWebsite Content:\n\n${combinedText.substring(0, 15000)}`;

      const aiRes = await geminiCallTool({
        systemPrompt,
        userMessage,
        maxTokens: 2000,
        model: "gemini-2.5-flash"
      });

      try {
        const rawContent = aiRes.content.trim();
        // More robust JSON extraction
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON object found in AI response");
        
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Add leading space if last name exists, otherwise empty string
        const lastNameWithSpace = parsed.decision_maker_last_name 
            ? " " + parsed.decision_maker_last_name.trim() 
            : "";

        const enrichedObj: EnrichedLead = {
          original_name: lead.name,
          company_name_short: parsed.company_name_short || lead.name,
          website: lead.website,
          decision_maker_name: parsed.decision_maker_full_name,
          decision_maker_last_name: lastNameWithSpace,
          email: allEmails[0], // Take the first found email as primary
          business_facts: parsed.business_facts || [],
          icebreaker_sentence: parsed.icebreaker_sentence,
          verification_status: parsed.verification_status || "flagged",
          verification_notes: parsed.verification_notes
        };
        enrichedLeads.push(enrichedObj);

        // Save progress to DB immediately ("zapochodu")
        try {
          await sql`
            INSERT INTO leads (
              website, original_name, company_name_short, decision_maker_name, decision_maker_last_name,
              primary_email, business_facts, icebreaker_sentence, verification_status, verification_notes, updated_at
            ) VALUES (
              ${enrichedObj.website},
              ${enrichedObj.original_name},
              ${enrichedObj.company_name_short},
              ${enrichedObj.decision_maker_name || null},
              ${enrichedObj.decision_maker_last_name || ""},
              ${enrichedObj.email || null},
              ${sql.json(enrichedObj.business_facts)},
              ${enrichedObj.icebreaker_sentence || null},
              ${enrichedObj.verification_status},
              ${enrichedObj.verification_notes || null},
              now()
            )
            ON CONFLICT (website) DO UPDATE SET
              original_name = EXCLUDED.original_name,
              company_name_short = EXCLUDED.company_name_short,
              decision_maker_name = EXCLUDED.decision_maker_name,
              decision_maker_last_name = EXCLUDED.decision_maker_last_name,
              primary_email = EXCLUDED.primary_email,
              business_facts = EXCLUDED.business_facts,
              icebreaker_sentence = EXCLUDED.icebreaker_sentence,
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
          decision_maker_name: "",
          decision_maker_last_name: "",
          business_facts: [],
          verification_status: "failed",
          verification_notes: "Could not parse AI response"
        };
        enrichedLeads.push(failedObj);

        try {
          await sql`
            INSERT INTO leads (
              website, original_name, company_name_short,
              decision_maker_name, decision_maker_last_name,
              business_facts, verification_status, verification_notes, updated_at
            ) VALUES (
              ${failedObj.website},
              ${failedObj.original_name},
              ${failedObj.company_name_short},
              ${failedObj.decision_maker_name || null},
              ${failedObj.decision_maker_last_name || ""},
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
