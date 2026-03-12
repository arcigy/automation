import { sql } from "../core/db";

async function verify() {
  const leads = await sql`
    SELECT website, official_company_name, ico, decision_maker_name, orsr_verified, campaign_tag 
    FROM leads 
    ORDER BY updated_at DESC
    LIMIT 5
  `;
  console.log(JSON.stringify(leads, null, 2));
  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
