import { z } from "zod";

export const inputSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  client_id: z.number().optional(),
  
  // Sequences (Optional if generateAiSequences is true)
  sequences: z.array(z.object({
    subject: z.string().min(1).optional(), // Some can be empty for threads
    body: z.string().min(1),
    delay_in_days: z.number().default(0)
  })).optional(),

  generateAiSequences: z.boolean().default(false),
  nicheDescription: z.string().optional(),
  customAiInstructions: z.string().optional(),

  // Leads (Optional)
  leads: z.array(z.object({
    email: z.string().email(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    company_name: z.string().optional(),
    custom_fields: z.record(z.string(), z.any()).optional()
  })).optional(),

  // Email accounts to use (IDs)
  email_account_ids: z.array(z.number()).min(1, "At least one email account must be linked"),

  // Webhooks
  webhook_url: z.string().url().optional(),
  webhook_events: z.array(z.string()).default(["LEAD_CATEGORY_UPDATED"]),

  // Settings
  daily_limit: z.number().default(50),
  min_delay_between_emails: z.number().default(5), // in minutes
  stop_on_reply: z.boolean().default(true),
  track_open: z.boolean().default(true),
  track_link_click: z.boolean().default(true),
  
  // Schedule
  schedule: z.object({
    timezone: z.string().default("Europe/Bratislava"),
    days: z.array(z.number()).default([1, 2, 3, 4, 5]), // Mon-Fri
    start_hour: z.string().default("09:00"),
    end_hour: z.string().default("17:00")
  }).optional()
});

export type Input = z.infer<typeof inputSchema>;

export type Output = {
  campaign_id: number;
  message: string;
};
