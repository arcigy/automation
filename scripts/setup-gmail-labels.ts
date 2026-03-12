import { ensureLabelExists } from "../tools/google/gmail-history.tool";

const SENDER_EMAILS = [
  'branislav.l@arcigy.group',
  'branislav@arcigy.group',
  'andrej.r@arcigy.group',
  'andrej@arcigy.group'
];

async function setup() {
  console.log("🟢 Setting up 'COLD-OUTREACH' label for all accounts...");
  
  for (const email of SENDER_EMAILS) {
    try {
      const labelId = await ensureLabelExists(email, "COLD-OUTREACH");
      console.log(`✅ Label 'COLD-OUTREACH' ready for ${email} (ID: ${labelId})`);
    } catch (err: any) {
      console.error(`❌ Failed for ${email}:`, err.message);
    }
  }
  
  process.exit(0);
}

setup();
