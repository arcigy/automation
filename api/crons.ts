import cron from "node-cron";
import { handler as dailyLeadgen } from "../automations/daily-leadgen/handler";
import { handler as dailyReport } from "../automations/daily-report/handler";
import { handler as eveningSummary } from "../automations/evening-summary/handler";
import { handler as manualReviewPickup } from "../automations/manual-review-pickup/handler";
import { handler as gmailAiReply } from "../automations/gmail-ai-reply/handler";

export function initCrons() {
  console.log("⏰ Inicializujem Cron plány...");

  // 1. Hlavný Lead Gen — každý pracovný deň o 21:00
  cron.schedule("0 21 * * 1-5", async () => {
    console.log("🌙 [CRON 21:00] Spúšťam Daily Lead Gen...");
    try {
      await dailyLeadgen({});
      console.log("✅ [CRON 21:00] Daily Lead Gen úspešne dokončený.");
    } catch (err) {
      console.error("💥 [CRON 21:00] Daily Lead Gen zlyhal:", err);
    }
  }, {
    timezone: "Europe/Bratislava"
  });

  // 2. Daily Report (Slack) — každý pracovný deň o 08:00
  cron.schedule("0 8 * * 1-5", async () => {
    console.log("☀️ [CRON 08:00] Spúšťam Daily Report...");
    try {
      await dailyReport();
      console.log("✅ [CRON 08:00] Daily Report odoslaný.");
    } catch (err) {
      console.error("💥 [CRON 08:00] Daily Report zlyhal:", err);
    }
  }, {
    timezone: "Europe/Bratislava"
  });

  // 2b. Evening Summary (Sync + Slack) — každý pracovný deň o 20:00
  cron.schedule("0 20 * * 1-5", async () => {
    console.log("🌙 [CRON 20:00] Spúšťam Evening Summary...");
    try {
      await eveningSummary();
      console.log("✅ [CRON 20:00] Evening Summary úspešne dokončený.");
    } catch (err) {
      console.error("💥 [CRON 20:00] Evening Summary zlyhal:", err);
    }
  }, {
    timezone: "Europe/Bratislava"
  });

  // 3. Manual Review Pickup — každý pracovný deň o 09:00
  cron.schedule("0 9 * * 1-5", async () => {
    console.log("🚚 [CRON 09:00] Spúšťam Manual Review Pickup...");
    try {
      await manualReviewPickup();
      console.log("✅ [CRON 09:00] Manual Review Pickup úspešne dokončený.");
    } catch (err) {
      console.error("💥 [CRON 09:00] Manual Review Pickup zlyhal:", err);
    }
  }, {
    timezone: "Europe/Bratislava"
  });

  // 4. Gmail AI Reply Polling — každých 10 minút
  cron.schedule("*/10 * * * *", async () => {
    console.log("📬 [CRON */10] Spúšťam Gmail AI Reply Polling...");
    try {
      await gmailAiReply({});
      console.log("✅ [CRON */10] Gmail AI Reply Polling úspešne dokončený.");
    } catch (err) {
      console.error("💥 [CRON */10] Gmail AI Reply Polling zlyhal:", err);
    }
  }, {
    timezone: "Europe/Bratislava"
  });

  console.log("✅ Cron plány sú aktívne (Timezone: Europe/Bratislava)");
}
