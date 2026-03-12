import { z } from "zod";

export const inputSchema = z.object({
  niche_slug: z.string(),
  keywords: z.array(z.string()),
  region: z.string(),
  target_count: z.number().default(195),
});

export type Input = z.infer<typeof inputSchema>;

export type DiscoveredLead = {
  name: string;
  website: string;
  phone?: string;
  source: "google_maps" | "serper";
  niche_slug: string;
  region: string;
};

export type Output = {
  leads: DiscoveredLead[];
  total_found: number;
  duplicates_skipped: number;
};
