import { sql } from "../core/db";

async function verify() {
  const websites = [
    'https://autoservis-bdm.sk/',
    'https://www.mikona.sk/predajna/mikona-martin-priekopska-32/',
    'https://nonstopservis9.webnode.sk/'
  ];
  
  const leads = await sql`
    SELECT website, ico, official_company_name, decision_maker_name, address, orsr_verified
    FROM leads 
    WHERE website IN ${sql(websites)}
  `;
  console.log(JSON.stringify(leads, null, 2));
  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
