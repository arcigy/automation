import { google } from "googleapis";
import { env } from "../../core/env";

export interface GmailMessage {
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  isMe: boolean;
}

export async function fetchGmailHistory(leadEmail: string, senderEmail: string): Promise<GmailMessage[]> {
  // Map sender email to correct refresh token from env
  const tokenKey = `GMAIL_REFRESH_TOKEN_${senderEmail.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const refreshToken = (process.env as any)[tokenKey];

  if (!refreshToken) {
    console.warn(`⚠️ No refresh token found for ${senderEmail} (key: ${tokenKey})`);
    return [];
  }

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  try {
    // Search for messages involving the lead email
    const response = await gmail.users.messages.list({
      userId: "me",
      q: leadEmail,
      maxResults: 20,
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return [];
    }

    const messages: GmailMessage[] = [];

    for (const msg of response.data.messages) {
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });

      const headers = fullMsg.data.payload?.headers || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "";
      const from = headers.find((h) => h.name === "From")?.value || "";
      const to = headers.find((h) => h.name === "To")?.value || "";
      const date = headers.find((h) => h.name === "Date")?.value || "";

      // Extract body
      let body = "";
      const parts = fullMsg.data.payload?.parts || [];
      const part = parts.find((p) => p.mimeType === "text/plain") || parts[0];
      
      if (part && part.body?.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (fullMsg.data.payload?.body?.data) {
        body = Buffer.from(fullMsg.data.payload.body.data, "base64").toString("utf-8");
      }

      // Cleanup CSS/HTML tags from snippet if needed, but we prefer plain text
      // Simple cleanup for now
      body = body.replace(/<[^>]*>?/gm, '').trim();

      messages.push({
        subject,
        from,
        to,
        date,
        body,
        isMe: from.toLowerCase().includes(senderEmail.toLowerCase()),
      });
    }

    // Sort by date (oldest first for history)
    return messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error: any) {
    console.error(`❌ Gmail API error for ${senderEmail}:`, error.message);
    return [];
  }
}
