import { google } from "googleapis";
import { env } from "../../core/env";

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000" // Traditional callback
);

if (env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: env.GOOGLE_REFRESH_TOKEN
  });
}

const sheets = google.sheets({ version: "v4", auth: oauth2Client });
const drive = google.drive({ version: "v3", auth: oauth2Client });

export async function createSpreadsheet(title: string): Promise<string> {
    const res = await sheets.spreadsheets.create({
        requestBody: { properties: { title } }
    });
    return res.data.spreadsheetId!;
}

export async function appendToSheet(
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });
}

export async function updateSheet(
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });
}

export async function getSheetRows(
  spreadsheetId: string,
  range: string
): Promise<any[][] | undefined | null> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values;
}

export async function clearSheet(
  spreadsheetId: string,
  range: string
): Promise<void> {
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
}

