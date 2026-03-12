import { z } from "zod";

const envSchema = z.object({
  API_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  NOTION_API_KEY: z.string().min(1).optional(),
  SMARTLEAD_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  SERPER_API_KEY: z.string().min(1).optional(),
  GOOGLE_MAPS_API_KEYS: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_SHEET_ID: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
});

export const env = envSchema.parse(process.env);
