import { inputSchema, type Input, type Output, type EnrichedLead } from "./schema";
import { logRun } from "../../core/logger";
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
      
      RETURN JSON FORMAT:
      {
        "decision_maker_name": "string or null",
        "business_facts": ["fact 1", "fact 2"],
        "verification_status": "verified" | "flagged",
        "verification_notes": "why it was flagged or why it is certain"
      }`;

      const userMessage = `Website Content for ${lead.website}:\n\n${combinedText.substring(0, 15000)}`;

      const aiRes = await geminiCallTool({
        systemPrompt,
        userMessage,
        maxTokens: 1000,
        model: "gemini-2.5-flash"
      });

      try {
        const cleanedContent = aiRes.content.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleanedContent);
        
        enrichedLeads.push({
          original_name: lead.name,
          website: lead.website,
          decision_maker_name: parsed.decision_maker_name,
          email: allEmails[0], // Take the first found email as primary
          business_facts: parsed.business_facts || [],
          verification_status: parsed.verification_status || "flagged",
          verification_notes: parsed.verification_notes
        });
      } catch (e) {
        console.error(`Detailed AI parsing error for ${lead.website}:`, e);
        enrichedLeads.push({
          original_name: lead.name,
          website: lead.website,
          business_facts: [],
          verification_status: "failed",
          verification_notes: "Could not parse AI response"
        });
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
