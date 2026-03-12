import { z } from "zod";

export const inputSchema = z.object({
  dry_run: z.boolean().optional().default(false),
});

export type Input = z.infer<typeof inputSchema>;
export type Output = {
  processedMessages: number;
  repliesSent: number;
  skipped: number;
  errors: number;
};
