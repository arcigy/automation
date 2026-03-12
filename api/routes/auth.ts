import { Hono } from "hono";
import { google } from "googleapis";
import { env } from "../../core/env";

const auth = new Hono();

const oauth2Client = (c: any) => {
    // Dynamicky určíme redirect URI podľa toho, kde server beží
    const host = c.req.header("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const redirectUri = `${protocol}://${host}/auth/google/callback`;
    
    return new google.auth.OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        redirectUri
    );
};

// 1. Spustenie prihlásenia
auth.get("/google", (c) => {
    const client = oauth2Client(c);
    const authUrl = client.generateAuthUrl({
        access_type: "offline",
        scope: [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.file"
        ],
        prompt: "consent"
    });
    return c.redirect(authUrl);
});

// 2. Callback z Google
auth.get("/google/callback", async (c) => {
    const code = c.req.query("code");
    if (!code) return c.text("Chýba autorizačný kód", 400);

    try {
        const client = oauth2Client(c);
        const { tokens } = await client.getToken(code);
        
        return c.html(`
            <div style="font-family: sans-serif; padding: 40px; text-align: center; background: #0f172a; color: white; min-height: 100vh;">
                <h1 style="color: #38bdf8;">✅ Autorizácia úspešná!</h1>
                <p>Tvoj Refresh Token je:</p>
                <div style="background: #1e293b; padding: 20px; border-radius: 8px; font-family: monospace; word-break: break-all; margin: 20px 0; border: 1px solid #334155;">
                    ${tokens.refresh_token}
                </div>
                <p style="color: #94a3b8;">Skopíruj tento kód a vlož ho do tvojho <b>.env</b> súboru ako:</p>
                <code>GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</code>
                <p style="margin-top: 40px; font-size: 0.9em; color: #64748b;">Potom reštartuj server a môžeme vytvárať tabuľky.</p>
            </div>
        `);
    } catch (e: any) {
        return c.text(`Chyba pri získavaní tokenu: ${e.message}`, 500);
    }
});

export { auth as authRoutes };
