import { inputSchema, type Input, type Output, type EnrichedLead } from "./schema";
import { logRun } from "../../core/logger";
import { sql } from "../../core/db";
import type { AutomationResult } from "../../core/types";
import { randomUUID } from "crypto";
import { webScraperTool } from "../../tools/scraping/web-scraper.tool";
import { geminiCallTool } from "../../tools/ai/gemini-call.tool";
import { detectSlovakSalutation } from "../../tools/gender/detector";
import { orsrMasterLookup, isValidIco } from "../../tools/scraping/orsr-scraper.tool";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function wait(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function callGeminiWithRetry(
  systemPrompt: string,
  userMessage: string,
  maxRetries = 4
): Promise<{ content: string } | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await geminiCallTool({
        systemPrompt,
        userMessage,
        maxTokens: 2000,
        model: "gemini-2.5-flash"
      });
      return res;
    } catch (err: any) {
      const msg = err.message || "";
      const isRateLimit = msg.includes("503") || msg.includes("429") || msg.includes("overloaded") || msg.includes("quota");

      if (isRateLimit && attempt < maxRetries) {
        const delay = attempt * 12000; // 12s, 24s, 36s ...
        console.log(`⏳ Gemini rate limit (pokus ${attempt}/${maxRetries}). Čakám ${delay / 1000}s...`);
        await wait(delay);
        continue;
      }
      throw err; // Iná chyba alebo vyčerpané retreries
    }
  }
  return null;
}

/** Tries to extract a valid IČO from raw AI text – cleans up common OCR errors */
function cleanAndValidateIco(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Remove spaces, dashes, letters (common AI mistakes)
  const clean = raw.replace(/[\s\-]/g, "").replace(/[^0-9]/g, "");
  // Pad with leading zeros if 7 digits (common omission)
  const padded = clean.length === 7 ? "0" + clean : clean;
  if (isValidIco(padded)) return padded;
  return null;
}

/** Extracts Full Name from email (e.g. jan.novak@domain.com -> Jan Novak) */
function extractNameFromEmail(email: string, companyNameShort?: string): string | null {
  if (!email) return null;
  const lower = email.toLowerCase();
  
  // 1. Generic/Functional word check
  const genericWords = new Set(["info", "kontakt", "contact", "mail", "hello", "office", "admin", "webmaster", "support", "sales", "dopyt", "objednavky", "predajna", "prijem", "servis", "marketing", "obchod", "technik", "administrativa", "ucl", "bratislava", "nitra", "zilina", "trnava", "kosice", "trencin", "poprad", "martin", "presov", "zvolen", "statny", "dozor", "www", "request", "valid", "test", "email", "priklad", "priklady", "example", "jan", "jana", "stavebnik", "katalog", "firmy", "zivefirmy", "hotline", "helpdesk", "postmaster", "hostmaster", "billing", "invoice", "faktury", "sklad", "vyroba", "dispecing"]);
  
  const localPart = lower.split("@")[0].replace(/[0-9]/g, ""); 
  const parts = localPart.split(/[._-]/).filter(p => p.length > 0);
  
  if (parts.some(p => genericWords.has(p))) return null;

  // 2. Discard known fake/example/functional emails
  if (lower.includes("jan@novak.sk") || lower.includes("email@email.sk") || lower.includes("priklad@email.sk") || lower.includes("example@")) return null;

  if (localPart.length < 3) return null;

  // 3. Skip if matches company name (e.g. radiant@radiant.sk)
  if (companyNameShort) {
    const cleanCompany = companyNameShort.toLowerCase().replace(/\s/g, "");
    if (cleanCompany.length > 4 && (localPart.includes(cleanCompany) || cleanCompany.includes(localPart))) return null;
  }

  // 4. Multi-part names (high confidence)
  // Catch patterns like j.novak, i.ryban, laubert.bb
  if (parts.length >= 2 && parts.some(p => p.length >= 3)) {
    return parts
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(" ");
  }
  
  // 5. Single names (like peter@...) - only if they are EXPLICITLY Slovak human names
  const commonSlovakNames = new Set([
      "jan", "peter", "jozef", "michal", "marek", "martin", "milan", "pavol", "ivan", "tomas", "stanislav", "vladimir", "igor", "dusan", "radoslav", "richard", "maros", "juraj", "andrej", "lukas", "matej", "filip", "robert", "matus", "jakub", "samuel", "roman", "adrian", "lubomir", "branislav",
      "maria", "jana", "zuzana", "katarina", "eva", "anna", "monika", "lenka", "lucia", "martina", "andrea", "helena", "viera", "vlasta", "daniela", "dagmar", "renata", "adriana", "ivana", "barbora"
  ]);
  
  if (commonSlovakNames.has(localPart)) {
      return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
  }

  return null;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function handler(
  rawInput: unknown,
): Promise<AutomationResult<Output>> {
  const ctx = {
    automationName: "lead-enricher",
    runId: randomUUID(),
    startTime: Date.now(),
  };

  const input = inputSchema.parse(rawInput);
  const campaignTag = input.campaign_tag || `manual_${new Date().toISOString()}`;

  // 1. Deduplicate by domain
  const uniqueDomainLeads = Array.from(new Map(
    input.leads.map(l => {
      try {
        const domain = new URL(l.website).hostname.replace("www.", "");
        return [domain, l];
      } catch {
        return [l.website, l];
      }
    })
  ).values());

  const enrichedLeads: EnrichedLead[] = [];

  try {
    for (const lead of uniqueDomainLeads) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🚀 ENRICHING: ${lead.website}`);
      console.log(`${"=".repeat(60)}`);

      try {
        // Polite delay between leads
        await wait(2500);

        // ══════════════════════════════════════════════════════
        // LOOP 1: Web scraping (homepage + subpages + email guess)
        // ══════════════════════════════════════════════════════
        console.log(`\n[Loop 1] Scraping webu...`);
        const scrapeResults = await webScraperTool({ url: lead.website, depth: 1 });

        if (!scrapeResults || scrapeResults.length === 0) {
           console.log(`⏭️  Scraping zlyhal alebo doména je na blackliste. Preskakujem.`);
           await sql`
             UPDATE leads 
             SET verification_status = 'failed', 
                 verification_notes = 'Blacklisted or scrape failed',
                 updated_at = now() 
             WHERE website = ${lead.website}
           `;
           continue;
        }
        const combinedText = scrapeResults
          .map(r => `--- PAGE: ${r.url} ---\n${r.text}`)
          .join("\n\n");

        // Collect all emails found across all pages
        const allEmailsRaw = [...new Set(scrapeResults.flatMap(r => r.emails))];
        const allPhones = [...new Set(scrapeResults.flatMap(r => r.phones))];
        console.log(`[Loop 1] Výsledok: ${scrapeResults.length} stránok, ${allEmailsRaw.length} emailov: ${allEmailsRaw.join(", ")}`);

        // ══════════════════════════════════════════════════════
        // LOOP 2: AI extraction
        // ══════════════════════════════════════════════════════
        console.log(`\n[Loop 2] AI extrakcia (Gemini)...`);
        const systemPrompt = `You are a professional lead researcher. Extract structured business data from Slovak company websites.

RULES:
1. Find the Decision Maker (Owner, CEO, Doctor, Founder) - the most senior person.
2. Analyze Emails: If an email local part clearly represents a human name (e.g. jozef.mrkvicka@...), and that person seems associated with the firm, consider them as the Decision Maker if no other name is verified.
3. Identify Last Name and Gender (for Slovak salutation: "pán" / "pani").
4. Extract IČO (Company Registration Number) - exactly 8 digits, found in footer, contact page, or legal info.
5. Extract official_company_name - the full legal name (e.g., "Novák & Partner s.r.o.").
6. Extract business_facts - 2-3 specific, interesting facts about the business for a personalized opener.
7. Create company_name_short - conversational, first-impression name (e.g., "Novák", "S-Autoservis").
8. Write icebreaker_sentence in Slovak: "Naozaj ma zaujalo, že [specific fact] – [why it matters today]."
9. If unsure about the decision maker, set verification_status to "flagged".
10. IČO MUST be exactly 8 digits. If you find 7, add leading zero. If not found, return null.

RETURN ONLY VALID JSON, NO MARKDOWN WRAPPER:
{
  "decision_maker_full_name": "string or null",
  "decision_maker_last_name": "string or null",
  "decision_maker_gender": "male" | "female" | "unknown",
  "ico": "8-digit string or null",
  "official_company_name": "string or null",
  "company_name_short": "string",
  "business_facts": ["fact1", "fact2"],
  "icebreaker_sentence": "Slovak sentence",
  "verification_status": "verified" | "flagged",
  "verification_notes": "reason if flagged, else null"
}`;

        const userMessage = `[TARGET_WEBSITE: ${lead.website}]
Company: ${lead.name}
Website: ${lead.website}
Phones found: ${allPhones.join(", ") || "none"}
Emails found: ${allEmailsRaw.join(", ") || "none"}
Potential names from emails: ${allEmailsRaw.map(e => {
  const n = extractNameFromEmail(e, lead.name);
  return n ? `${e} -> ${n}` : null;
}).filter(Boolean).join(", ") || "none"}

Website Content:
${combinedText.substring(0, 12000)}`;

        console.log(`\n💎 [Loop 2] Gemini UserMessage (prvých 150zn): "${userMessage.substring(0, 150)}..."`);


        let aiRes = await callGeminiWithRetry(systemPrompt, userMessage);
        if (!aiRes) throw new Error("Gemini nevrátil odpoveď po všetkých retries.");

        const rawContent = aiRes.content.trim();
        let parsed: any;

        try {
          // Robustnejšie parsovanie: nájdi prvý { a posledný }
          const start = rawContent.indexOf("{");
          const end = rawContent.lastIndexOf("}");
          if (start === -1 || end === -1) throw new Error("No JSON boundaries found");
          const jsonStr = rawContent.substring(start, end + 1);
          parsed = JSON.parse(jsonStr);
        } catch (err: any) {
          console.error(`❌ JSON Parse Error: ${err.message}`);
          console.error(`📄 RAW CONTENT: ${rawContent}`);
          throw new Error(`Zlyhalo parsovanie JSON-u z AI: ${err.message}`);
        }
        
        console.log(`[Loop 2] AI výsledok: name="${parsed.decision_maker_full_name}", IČO="${parsed.ico}", company="${parsed.official_company_name}"`);


        // ══════════════════════════════════════════════════════
        // LOOP 3: IČO validation + cleanup
        // ══════════════════════════════════════════════════════
        console.log(`\n[Loop 3] Validácia IČO...`);
        const validatedIco = cleanAndValidateIco(parsed.ico);
        if (parsed.ico && !validatedIco) {
          console.warn(`⚠️ AI vrátila neplatné IČO "${parsed.ico}" — ignorujem, pôjdem cez meno.`);
        }
        console.log(`[Loop 3] IČO: "${parsed.ico}" → validované: "${validatedIco || "null"}"`);

        // ══════════════════════════════════════════════════════
        // LOOP 4: ORSR/ZRSR master lookup (A→B→C)
        // ══════════════════════════════════════════════════════
        console.log(`\n[Loop 4] Register lookup (ORSR/ZRSR)...`);
        let orsrData = null;
        try {
          orsrData = await orsrMasterLookup({
            ico: validatedIco,
            companyName: parsed.official_company_name || lead.name
          });
        } catch (orsrErr: any) {
          console.warn(`⚠️ Register lookup zlyhal: ${orsrErr.message}`);
        }

        // ══════════════════════════════════════════════════════
        // MERGE: AI + ORSR/ZRSR data
        // ══════════════════════════════════════════════════════
        console.log(`\n[Merge] Spájam AI + register dáta...`);

        let finalDecisionMaker = parsed.decision_maker_full_name || null;
        let finalOfficialName = parsed.official_company_name || null;
        let finalAddress: string | undefined;
        let finalIco = validatedIco || undefined;
        let orsrVerified = false;
        let verificationNotes = parsed.verification_notes || null;

        if (orsrData) {
          // Official name — ORSR je vždy presnejší
          if (orsrData.companyName) {
            finalOfficialName = orsrData.companyName;
          }
          // Address from register
          if (orsrData.address) finalAddress = orsrData.address;
          // IČO from register (authoritative)
          if (orsrData.ico && isValidIco(orsrData.ico)) finalIco = orsrData.ico;

          // Decision maker merge logic
          if (orsrData.executives.length > 0) {
            const orsrExec = orsrData.executives[0];

            if (!finalDecisionMaker) {
              // AI nenašla — ORSR doplní
              finalDecisionMaker = orsrExec;
              console.log(`👤 DM doplnený z registra (${orsrData.source}): ${orsrExec}`);
              orsrVerified = true;
            } else {
              // Porovnaj priezvisko AI vs ORSR
              const aiLastName = (parsed.decision_maker_last_name || "").toLowerCase().trim();
              const orsrMatch = orsrData.executives.some(e =>
                aiLastName.length > 2 && e.toLowerCase().includes(aiLastName)
              );

              if (orsrMatch) {
                console.log(`✅ DM overený registrom: "${finalDecisionMaker}" súhlasí s "${orsrExec}"`);
                orsrVerified = true;
              } else {
                console.log(`⚠️ DM nesúlad: AI="${finalDecisionMaker}" ≠ Register="${orsrExec}". Prepisujem na register.`);
                verificationNotes = [verificationNotes, `Register conflict: AI="${finalDecisionMaker}", Register="${orsrExec}"`]
                  .filter(Boolean).join(" | ");
                finalDecisionMaker = orsrExec;
                orsrVerified = true;
              }
            }
          } else if (orsrData.partners.length > 0 && !finalDecisionMaker) {
            // Ak nie sú konatelia ale sú spoločníci, použij prvého
            finalDecisionMaker = orsrData.partners[0];
            console.log(`👤 DM z partnerov registra: ${finalDecisionMaker}`);
          }

          if (orsrData.companyName) orsrVerified = true;
          console.log(`[Merge] Register (${orsrData.source}): name="${orsrData.companyName}", exec="${orsrData.executives[0] || "?"}"`);
        } else {
          console.log(`[Merge] Žiadne register dáta — používam iba AI výstupy.`);
        }

        // ══════════════════════════════════════════════════════
        // LOOP 5: Email & Name merging
        // ══════════════════════════════════════════════════════
        const sortedEmails = [...allEmailsRaw].sort((a, b) => {
          const aIsGeneric = /^(info|kontakt|contact|mail|hello|office|admin|webmaster|support|sales|dopyt|objednavky|predajna|prijem|servis)@/.test(a);
          const bIsGeneric = /^(info|kontakt|contact|mail|hello|office|admin|webmaster|support|sales|dopyt|objednavky|predajna|prijem|servis)@/.test(b);
          return (aIsGeneric ? 1 : 0) - (bIsGeneric ? 1 : 0);
        });
        const bestEmail = sortedEmails[0];

        const isGenericTitle = (n: string) => /^(konateľ|konatelia|majiteľ|majitelia|majitel|riaditeľ|riaditel|podnikateľ|podnikatel|vlastník|vlastnik|webmaster|admin|info|jan|stavebnik|statny|dozor|request|valid|www|email|i-lina|priklad)$/i.test(n.trim());
        
        if (bestEmail) {
          const emailName = extractNameFromEmail(bestEmail, parsed.company_name_short);
          const hasSeparator = bestEmail.split("@")[0].includes(".") || bestEmail.split("@")[0].includes("_");
          
          if (emailName && (hasSeparator || !finalDecisionMaker || isGenericTitle(finalDecisionMaker))) {
             console.log(`📧 DM prepísaný/extrahovaný z emailu: ${finalDecisionMaker || "(null)"} -> ${emailName} (${bestEmail})`);
             finalDecisionMaker = emailName;
          }
        }

        // ══════════════════════════════════════════════════════
        // LOOP 6: Salutation detection
        // ══════════════════════════════════════════════════════
        let lastNameFormatted = "";
        if (finalDecisionMaker) {
          const nameParts = finalDecisionMaker.trim().split(/\s+/);
          const firstName = nameParts[0] || "";
          const lastName = nameParts[nameParts.length - 1] || "";
          // Override with detected gender from AI if available
          const gender = parsed.decision_maker_gender;
          let salutation: string;
          if (gender === "female") {
            salutation = "pani";
          } else if (gender === "male") {
            salutation = "pán";
          } else {
            salutation = detectSlovakSalutation(firstName, lastName);
          }
          lastNameFormatted = ` ${salutation} ${lastName}`;
        }

        const enrichedObj: EnrichedLead = {
          original_name: lead.name,
          company_name_short: parsed.company_name_short || lead.name,
          website: lead.website,
          decision_maker_name: finalDecisionMaker || undefined,
          decision_maker_last_name: lastNameFormatted || undefined,
          email: bestEmail,
          business_facts: parsed.business_facts || [],
          icebreaker_sentence: parsed.icebreaker_sentence,
          ico: finalIco,
          official_company_name: finalOfficialName || undefined,
          address: finalAddress,
          orsr_verified: orsrVerified,
          verification_status: parsed.verification_status || "flagged",
          verification_notes: verificationNotes || undefined,
          campaign_tag: campaignTag
        };
        enrichedLeads.push(enrichedObj);

        // ══════════════════════════════════════════════════════
        // DB: Uloženie
        // ══════════════════════════════════════════════════════
        try {
          await sql`
            INSERT INTO leads (
              website, original_name, company_name_short, decision_maker_name, decision_maker_last_name,
              primary_email, business_facts, icebreaker_sentence, ico, official_company_name,
              address, orsr_verified,
              verification_status, verification_notes, campaign_tag, updated_at
            ) VALUES (
              ${enrichedObj.website},
              ${enrichedObj.original_name},
              ${enrichedObj.company_name_short},
              ${enrichedObj.decision_maker_name || null},
              ${enrichedObj.decision_maker_last_name || ""},
              ${enrichedObj.email || null},
              ${sql.json(enrichedObj.business_facts)},
              ${enrichedObj.icebreaker_sentence || null},
              ${enrichedObj.ico || null},
              ${enrichedObj.official_company_name || null},
              ${enrichedObj.address || null},
              ${enrichedObj.orsr_verified ?? false},
              ${enrichedObj.verification_status},
              ${enrichedObj.verification_notes || null},
              ${campaignTag},
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
              ico = EXCLUDED.ico,
              official_company_name = EXCLUDED.official_company_name,
              address = EXCLUDED.address,
              orsr_verified = EXCLUDED.orsr_verified,
              verification_status = EXCLUDED.verification_status,
              verification_notes = EXCLUDED.verification_notes,
              campaign_tag = COALESCE(leads.campaign_tag, EXCLUDED.campaign_tag),
              updated_at = EXCLUDED.updated_at;
          `;
          console.log(`\n💾 DB uložené: ${lead.website}`);
          console.log(`   DM: ${enrichedObj.decision_maker_name || "N/A"} | Email: ${enrichedObj.email || "N/A"} | ORSR: ${orsrVerified ? "✅" : "⬜"} | IČO: ${enrichedObj.ico || "N/A"}`);
        } catch (dbErr) {
          console.error(`❌ DB zlyhal pre ${lead.website}:`, dbErr);
        }

      } catch (e: any) {
        console.error(`\n❌ Chyba pri ${lead.website}: ${e.message}`);

        const failedObj: EnrichedLead = {
          original_name: lead.name,
          company_name_short: lead.name,
          website: lead.website,
          decision_maker_name: undefined,
          decision_maker_last_name: undefined,
          business_facts: [],
          verification_status: "failed",
          verification_notes: e.message || "Enrichment failed",
          campaign_tag: campaignTag
        };
        enrichedLeads.push(failedObj);

        try {
          await sql`
            INSERT INTO leads (
              website, original_name, company_name_short,
              decision_maker_name, decision_maker_last_name,
              business_facts, verification_status, verification_notes, campaign_tag, updated_at
            ) VALUES (
              ${failedObj.website}, ${failedObj.original_name}, ${failedObj.company_name_short},
              ${null}, ${""},
              ${sql.json([])},
              ${failedObj.verification_status}, ${failedObj.verification_notes || null},
              ${campaignTag}, now()
            )
            ON CONFLICT (website) DO UPDATE SET
              verification_status = EXCLUDED.verification_status,
              verification_notes = EXCLUDED.verification_notes,
              campaign_tag = COALESCE(leads.campaign_tag, EXCLUDED.campaign_tag),
              updated_at = EXCLUDED.updated_at;
          `;
        } catch (dbErr) {
          console.error(`❌ DB zlyhal pre failed-lead ${lead.website}:`, dbErr);
        }
      }
    }

    const result: AutomationResult<Output> = {
      success: true,
      data: { leads: enrichedLeads },
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
