import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const result = await sql`SELECT count(*) FROM leads WHERE campaign_tag = 'tepelne-cerpadla'`;
  console.log(`Leads for tepelne-cerpadla: ${result[0].count}`);
  
  const pending = await sql`SELECT count(*) FROM leads WHERE campaign_tag = 'tepelne-cerpadla' AND verification_status IS NULL`;
  console.log(`Pending enrichment: ${pending[0].count}`);
  
  const salutations = await sql`
    SELECT count(*) FROM leads 
    WHERE campaign_tag = 'tepelne-cerpadla' 
    AND (decision_maker_last_name LIKE '% pán %' OR decision_maker_last_name LIKE '% pani %' OR decision_maker_last_name LIKE ' pán%' OR decision_maker_last_name LIKE ' pani%')
  `;
  console.log(`Leads with salutations: ${salutations[0].count}`);
  
  const withEmail = await sql`
    SELECT count(*) FROM leads 
    WHERE campaign_tag = 'tepelne-cerpadla' 
    AND primary_email IS NOT NULL
  `;
  console.log(`Leads with email: ${withEmail[0].count}`);
  
  const failed = await sql`
    SELECT count(*) FROM leads 
    WHERE campaign_tag = 'tepelne-cerpadla' 
    AND verification_status = 'failed'
  `;
  console.log(`Leads failed: ${failed[0].count}`);
  
  await sql.end();
}
main();
