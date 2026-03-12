import { google } from "googleapis";
import { env } from "../core/env";

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  "http://localhost:3000" // Traditional callback URI
);

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file"
];

async function run() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.error("❌ Chýba GOOGLE_CLIENT_ID alebo GOOGLE_CLIENT_SECRET v .env");
    return;
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent"
  });

  console.log("\n------------------------------------------------");
  console.log("🚀 KROK 1: Klikni na tento link a autorizuj aplikáciu:");
  console.log("------------------------------------------------");
  console.log(authUrl);
  console.log("------------------------------------------------\n");
  console.log("🚀 KROK 2: Po autorizácii ťa to hodí na chybu (localhost:3000 not found).");
  console.log("TO JE V PORIADKU! Skopíruj celú tú URL adresu z prehliadača (obsahuje ?code=...)");
  console.log("a vlož ju sem do terminálu.");
  console.log("------------------------------------------------\n");
  
  process.stdout.write("Vlož URL alebo kód sem: ");
  process.stdin.on("data", async (data) => {
    const input = data.toString().trim();
    let code = input;
    
    if (input.includes("code=")) {
      const url = new URL(input);
      code = url.searchParams.get("code") || input;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log("\n✅ ÚSPECH! Tvoj Refresh Token je:");
      console.log("------------------------------------------------");
      console.log(tokens.refresh_token);
      console.log("------------------------------------------------");
      console.log("\nUlož tento token do tvojho .env súboru ako:");
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log("------------------------------------------------");
      process.exit(0);
    } catch (e: any) {
      console.error("❌ Chyba pri získavaní tokenu:", e.message);
      process.exit(1);
    }
  });
}

run();
