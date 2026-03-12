import { geminiCallTool } from "../ai/gemini-call.tool";
import { readFileSync } from "fs";
import { join } from "path";

export interface Sequence {
  seq_number: number;
  seq_delay_details: { delay_in_days: number };
  seq_variants: Array<{
    variant_label: string;
    subject: string;
    email_body: string;
  }>;
}

export interface SequenceGeneratorInput {
  nicheName: string;
  nicheDescription?: string;
  customInstructions?: string;
}

export async function smartleadGenerateSequencesTool(input: SequenceGeneratorInput): Promise<Sequence[]> {
  // 1. Read the system prompt from the .md file
  const promptPath = join(process.cwd(), "prompts", "smartlead-sequence-ai.md");
  let systemPrompt = "Si expert na cold email outreach.";
  try {
      systemPrompt = readFileSync(promptPath, "utf-8");
  } catch (err) {
      console.warn("⚠️ Could not read sequences prompt file, using default.", err);
  }

  // 2. Prepare user message
  const userMessage = `
Niche: ${input.nicheName}
Popis/Kontext: ${input.nicheDescription || "N/A"}
Dodatočné inštrukcie: ${input.customInstructions || "Žiadne"}

Vytvor 3-krokovú sekvenciu (Step 1, Step 2 po 3 dňoch, Step 3 po 5 dňoch).
Vráť to ako čistý JSON v tomto formáte:
{
  "sequences": [
    {
      "seq_number": 1,
      "seq_delay_details": { "delay_in_days": 0 },
      "seq_variants": [
        { "variant_label": "A", "subject": "...", "email_body": "..." }
      ]
    },
    ...
  ]
}
`;

  // 3. Call Gemini 2.5 Flash
  const aiResult = await geminiCallTool({
    systemPrompt,
    userMessage,
    model: "gemini-2.5-flash"
  });

  // 4. Parse and return
  try {
    // Basic cleaning in case AI returns markdown code blocks
    let cleaned = aiResult.content.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "");
    else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```/, "").replace(/```$/, "");
    
    const parsed = JSON.parse(cleaned.trim());
    return parsed.sequences;
  } catch (e) {
    console.error("🔥 Failed to parse AI sequences JSON:", aiResult.content);
    throw new Error("AI failed to return valid sequence JSON.");
  }
}
