import { z } from "zod";

export const inputSchema = z.object({
  leads: z.array(z.object({
    name: z.string(),
    website: z.string().url(),
    original_phone: z.string().optional()
  })).min(1),
  aggressive_scraping: z.boolean().default(true)
});

export type Input = z.infer<typeof inputSchema>;

export type EnrichedLead = {
  original_name: string;
  company_name_short: string;
  website: string;
  decision_maker_name?: string;
  decision_maker_last_name?: string;
  email?: string;
  business_facts: string[];
  icebreaker_sentence?: string;
  verification_status: "verified" | "flagged" | "failed";
  verification_notes?: string;
};

export type Output = {
  leads: EnrichedLead[];
};
