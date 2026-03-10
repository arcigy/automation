import { z } from "zod";

export const inputSchema = z.object({
  query: z.string().min(1, "Search query is required (e.g. 'Zubári v Bratislave')"),
  limit: z.number().max(50).default(20),
  use_maps: z.boolean().default(true),
  use_serper: z.boolean().default(true)
});

export type Input = z.infer<typeof inputSchema>;

export type Lead = {
  name: string;
  website?: string;
  phone?: string;
  source: "google_maps" | "serper";
  relevance_score?: number;
};

export type Output = {
  leads: Lead[];
  count: number;
};
