import { fetchGmailHistory } from "../tools/google/gmail-history.tool";

async function testGmailHistory() {
  const leadEmail = "info@gkng.sk";
  const senders = ["branislav@arcigy.group", "branislav.l@arcigy.group", "andrej@arcigy.group", "andrej.r@arcigy.group"];

  for (const senderEmail of senders) {
    console.log(`\n🔍 Fetching Gmail history for ${leadEmail} from account ${senderEmail}...`);
    const history = await fetchGmailHistory(leadEmail, senderEmail);

  if (history.length === 0) {
    console.log("ℹ️ No history found in Gmail.");
  } else {
    console.log(`✅ Found ${history.length} messages:`);
    history.forEach((m, i) => {
      console.log(`\n[${i + 1}] ${m.date}`);
      console.log(`From: ${m.from}`);
      console.log(`Subject: ${m.subject}`);
      console.log(`Snippet: ${m.body.substring(0, 100)}...`);
    });
    }
  }
}

testGmailHistory().catch(console.error);
