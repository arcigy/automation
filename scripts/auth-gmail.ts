import { google } from "googleapis";
import { env } from "../core/env";
import http from "http";
import url from "url";
import fs from "fs";

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

const scopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email"
];

async function startAutomatedAuth() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url?.startsWith("/auth/google/callback")) {
        const query = new url.URL(req.url, "http://localhost:3000").searchParams;
        const code = query.get("code");

        if (!code) {
          res.end("Chyba: Kod nebol najdeny v URL.");
          return;
        }

        console.log(`\n✅ Kod prijaty, vymienam za tokeny...`);
        const { tokens } = await oauth2Client.getToken(code);
        
        // Ziskanie emailu
        const ticket = await oauth2Client.verifyIdToken({
          idToken: tokens.id_token!,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const email = ticket.getPayload()?.email;
        if (!email) throw new Error("Nepodarilo sa ziskat email z tokenu.");

        // Vygenerovanie unikatneho kluca podla celeho emailu
        // Napr. GMAIL_REFRESH_TOKEN_BRANISLAV_ARCIGY_GROUP
        const envKey = `GMAIL_REFRESH_TOKEN_${email.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

        console.log(`\n🎉 USPECH!`);
        console.log(`Email: ${email}`);
        console.log(`Refresh Token: ${tokens.refresh_token}`);

        // Precitat aktualny .env a skontrolovat ci kluc uz existuje (aby sme nedupľovali tie iste)
        let envContent = fs.readFileSync(".env", "utf8");
        const envLine = `${envKey}=${tokens.refresh_token}`;
        
        if (envContent.includes(envKey)) {
            // Nahradit existujuci
            const regex = new RegExp(`${envKey}=.*`, 'g');
            envContent = envContent.replace(regex, envLine);
            console.log(`\n🔄 Token pre ${email} bol aktualizovany.`);
        } else {
            // Pridat na koniec
            envContent += `\n${envLine}\n`;
            console.log(`\n💾 Token bol pridam do .env ako ${envKey}`);
        }
        
        fs.writeFileSync(".env", envContent.trim() + "\n");

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #f4f7f6;">
              <div style="display: inline-block; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="color: #2ecc71;">✅ Hotovo!</h1>
                <p>Prístup pre <b>${email}</b> bol úspešne udelený.</p>
                <p>Refresh token bol uložený do <code>.env</code> ako <code>${envKey}</code>.</p>
                <p style="color: #7f8c8d; font-size: 0.9em;">Teraz môžeš zavrieť tento tab a vrátiť sa do chatu pre ďalší link.</p>
              </div>
            </body>
          </html>
        `);
        
        setTimeout(() => process.exit(0), 1000);
      }
    } catch (e: any) {
      console.error("\n❌ Chyba:", e.message);
      res.end("Chyba spracovania. Pozri terminal.");
    }
  });

  server.listen(3000, () => {
    console.log("\n------------------------------------------------------------------");
    console.log("🚀 UNIKÁTNA AUTORIZÁCIA SPUSTENÁ");
    console.log("------------------------------------------------------------------");
    console.log("\n1. Klikni na tento link:");
    console.log(authUrl);
    console.log("\n2. Prihlás sa a potvrď prístup.");
    console.log("------------------------------------------------------------------\n");
  });
}

startAutomatedAuth().catch(console.error);
