import { z } from 'zod';

// Webhook payload od Smartlead (LEAD_CATEGORY_UPDATED event)
export const inputSchema = z.object({
  to_email: z.string().email(),           // email leada
  from_email: z.string().email().optional(), // náš email
  from_name: z.string().optional(),
  lead_name: z.string().optional(),
  campaign_id: z.union([z.string(), z.number()]).transform(String),
  campaign_name: z.string().optional(),
  category_name: z.string(),              // "Interested", "Positive", atď.
  email_body: z.string().optional(),      // posledná odpoveď leada (ak je v payload)
  time: z.string().optional(),
  type: z.string().optional(),
  dry_run: z.boolean().optional().default(false),
});

export type SmartleadWebhookInput = z.infer<typeof inputSchema>;

// Štruktúra správy z message-history API
export const messageHistoryItemSchema = z.object({
  stats_id: z.string().optional(),
  message_id: z.string().optional(),
  email_body: z.string().optional(),
  subject: z.string().optional(),
  send_time: z.string().optional(),
  created_at: z.string().optional(),
  type: z.string().optional(),           // "EMAIL_SENT" | "EMAIL_REPLY" atď.
  from_email: z.string().optional(),
});

export type MessageHistoryItem = z.infer<typeof messageHistoryItemSchema>;

export type SmartleadOutput = {
  leadEmail: string;
  replySent: boolean;
  aiReply: string;
  smartleadResponseStatus: number;
  usedEmailStatsId: string;
  dry_run: boolean;
};
