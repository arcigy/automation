import { z } from "zod";

export const inputSchema = z.object({
  leads: z.array(z.object({
    name: z.string(),
    website: z.string().url(),
    original_phone: z.string().optional()
  })).min(1),
  aggressive_scraping: z.boolean().default(true),
  campaign_tag: z.string().optional()
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
  ico?: string;
  official_company_name?: string;
  address?: string;
  orsr_verified?: boolean;
  verification_status: "verified" | "flagged" | "failed";
  verification_notes?: string;
  campaign_tag?: string;
};

export type Output = {
  leads: EnrichedLead[];
};
