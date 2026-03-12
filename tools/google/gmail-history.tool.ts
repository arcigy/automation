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

export async function fetchThreadHistory(threadId: string, senderEmail: string): Promise<GmailMessage[]> {
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
    const response = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return [];
    }

    const messages: GmailMessage[] = [];

    for (const msg of response.data.messages) {
      const headers = msg.payload?.headers || [];
      const subject = headers.find((h) => h.name === "Subject")?.value || "";
      const from = headers.find((h) => h.name === "From")?.value || "";
      const to = headers.find((h) => h.name === "To")?.value || "";
      const date = headers.find((h) => h.name === "Date")?.value || "";

      let body = "";
      const parts = msg.payload?.parts || [];
      const part = parts.find((p) => p.mimeType === "text/plain") || parts[0];
      
      if (part && part.body?.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, "base64").toString("utf-8");
      }

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

    return messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } catch (error: any) {
    console.error(`❌ Gmail API error fetching thread for ${senderEmail}:`, error.message);
    return [];
  }
}

export interface UnreadMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
}

export async function fetchUnreadInboxMessages(senderEmail: string, maxResults: number = 20): Promise<UnreadMessage[]> {
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
    // Only fetch unread messages in the primary inbox
    const response = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread category:primary",
      maxResults,
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      return [];
    }

    const unreadMessages: UnreadMessage[] = [];

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

      body = body.replace(/<[^>]*>?/gm, '').trim();

      unreadMessages.push({
        id: msg.id!,
        threadId: msg.threadId!,
        from,
        to,
        subject,
        date,
        snippet: fullMsg.data.snippet || "",
        body,
      });
    }

    return unreadMessages;
  } catch (error: any) {
    console.error(`❌ Gmail API error fetching unread for ${senderEmail}:`, error.message);
    return [];
  }
}

export async function sendGmailReply(
  senderEmail: string,
  toEmail: string,
  subject: string,
  threadId: string,
  messageId: string,
  bodyHtml: string
): Promise<boolean> {
  const tokenKey = `GMAIL_REFRESH_TOKEN_${senderEmail.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const refreshToken = (process.env as any)[tokenKey];

  if (!refreshToken) {
    throw new Error(`No refresh token found for ${senderEmail}`);
  }

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  try {
    const rawMessage = [
      `To: ${toEmail}`,
      `Subject: Re: ${subject.replace(/^Re:\s*/i, '')}`, // Ensure only one "Re:"
      `In-Reply-To: ${messageId}`,
      `References: ${messageId}`,
      `Content-Type: text/html; charset=utf-8`,
      `MIME-Version: 1.0`,
      ``,
      bodyHtml
    ].join('\r\n');

    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: threadId
      }
    });

    return true;
  } catch (error: any) {
    console.error(`❌ Failed to send Gmail reply for ${senderEmail}:`, error.message);
    throw error;
  }
}

export async function ensureLabelExists(senderEmail: string, labelName: string): Promise<string> {
  const tokenKey = `GMAIL_REFRESH_TOKEN_${senderEmail.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const refreshToken = (process.env as any)[tokenKey];

  if (!refreshToken) throw new Error(`No token for ${senderEmail}`);

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  try {
    const list = await gmail.users.labels.list({ userId: "me" });
    const existing = list.data.labels?.find(l => l.name === labelName);
    
    if (existing) return existing.id!;

    // Create label if not exists
    const res = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: labelName,
        labelListVisibility: "labelShow",
        messageListVisibility: "show"
      }
    });
    return res.data.id!;
  } catch (error: any) {
    console.error(`❌ Error ensuring label ${labelName} for ${senderEmail}:`, error.message);
    throw error;
  }
}

export async function addLabelToThread(senderEmail: string, threadId: string, labelId: string): Promise<void> {
  const tokenKey = `GMAIL_REFRESH_TOKEN_${senderEmail.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const refreshToken = (process.env as any)[tokenKey];

  if (!refreshToken) throw new Error(`No token for ${senderEmail}`);

  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  try {
    await gmail.users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: {
        addLabelIds: [labelId]
      }
    });
  } catch (error: any) {
    console.error(`❌ Error adding label to thread ${threadId} for ${senderEmail}:`, error.message);
  }
}
