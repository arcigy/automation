import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
  const badLeads = [
    { website: "https://www.recos.sk/", reason: "Garbage name Fffeaecad" },
    { website: "http://www.solargo.sk/", reason: "Scraping error Ebcfeeee" },
    { website: "https://www.info-zilina.sk/", reason: "Portal name Ilina" },
    { website: "https://www.stachovic.sk/", reason: "Generic Infostachovic" },
    { website: "https://www.smartlist.sk/", reason: "Generic Request Valid" },
    { website: "https://mdmgroup.sk/", reason: "Generic Statny Dozor" },
    { website: "https://www.mbklima.sk/", reason: "Generic Statny Dozor" },
    { website: "https://www.info-bystrica.sk/", reason: "Generic Www Akumul" },
    { website: "https://www.zoznam.sk/", reason: "Generic Www Klimatizacie" },
    { website: "https://www.kosiceklimaac.sk/", reason: "Generic Jan" },
    { website: "https://sluzby.bazos.sk/", reason: "Bazos portal" },
    { website: "https://teplozima.sk/", reason: "Single name Martin" },
    { website: "https://www.klimamonter.sk/", reason: "Adam Bartal utf8 error? No, let's keep but fix salutation" }
  ];

  console.log("🧹 Cleaning up bad names...");
  for (const lead of badLeads) {
     await sql`
       UPDATE leads 
       SET decision_maker_name = NULL, decision_maker_last_name = NULL, verification_status = 'failed'
       WHERE website LIKE ${'%' + lead.website.replace('https://', '').replace('http://', '').replace('/', '') + '%'}
     `;
     console.log(`✅ Reset: ${lead.website} (${lead.reason})`);
  }

  console.log("\n🛠️ Fixing titles (pán PhD. -> pán Name)...");
  
  // Hand-tuned fixes for specifically identified bad salutations in review
  const fixes = [
      { dm: "Imrich Ruščák st.", last: " pán Ruščák" },
      { dm: "Ing. Gabriel Arbet, PhD.", last: " pán Arbet" },
      { dm: "Ing. Ján Laboš, PhD.", last: " pán Laboš" },
      { dm: "Ing. Branislav Haško", last: " pán Haško" },
      { dm: "Ing. František Beňo", last: " pán Beňo" }
  ];

  for (const f of fixes) {
      await sql`
        UPDATE leads 
        SET decision_maker_last_name = ${f.last}
        WHERE decision_maker_name = ${f.dm}
      `;
      console.log(`✅ Fixed Salutation: ${f.dm} -> ${f.last}`);
  }

  await sql.end();
}
main();
