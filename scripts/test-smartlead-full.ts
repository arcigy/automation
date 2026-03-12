import axios from "axios";
import { env } from "../core/env";

const BASE_URL = "https://server.smartlead.ai/api/v1";
const API_KEY = env.SMARTLEAD_API_KEY?.trim();

async function testFullCampaign() {
  console.log("🧪 TEST: Kompletné vytvorenie kampane v Smartlead (cez Axios)\n");

  if (!API_KEY) {
      console.error("❌ Chýba SMARTLEAD_API_KEY v .env");
      return;
  }

  try {
      // 1. Vytvorenie kampane
      console.log("1. Vytváram kampaň...");
      const campaignName = `TEST_ARCIGY_AUTOMATION_${Date.now()}`;
      const createRes = await axios.post(`${BASE_URL}/campaigns/create`, {
          name: campaignName,
          client_id: null
      }, {
          params: { api_key: API_KEY }
      });

      const campaignId = createRes.data.id;
      console.log(`✅ Kampaň vytvorená: ${campaignName} (ID: ${campaignId})`);

      // 2. Pridanie sekvencie
      console.log("\n2. Pridávam sekvenciu...");
      await axios.post(`${BASE_URL}/campaigns/${campaignId}/sequences`, {
          sequences: [
              {
                  seq_number: 1,
                  seq_delay_details: { delay_in_days: 0 },
                  seq_variants: [
                      {
                          subject: "Testovacia správa pre {{company_name}}",
                          email_body: `<p>Ahoj {{first_name}},</p><p>Toto je testovacia kampaň vytvorená cez automatizáciu pre firmu {{company_name}}.</p><p>{{icebreaker}}</p><p>Daj vedieť či to dorazilo v poriadku!</p>`,
                          variant_label: "A"
                      }
                  ]
              }
          ]
      }, {
          params: { api_key: API_KEY }
      });
      console.log("✅ Sekvencia pridaná.");

      // 3. Pridanie 5 leadov
      console.log("\n3. Pridávam 5 leadov...");
      const leads = [
          { first_name: "Peter", last_name: "Test", email: "peter.test@example.com", company_name: "Firma A", location: "Bratislava", custom_fields: { icebreaker: "Vaša firma v BA vyzerá super!" } },
          { first_name: "Anna", last_name: "Vzorová", email: "anna.vzor@example.com", company_name: "Firma B", location: "Košice", custom_fields: { icebreaker: "Zaujali ma vaše referencie z KE." } },
          { first_name: "Michal", last_name: "Demo", email: "michal.demo@example.com", company_name: "Firma C", location: "Žilina", custom_fields: { icebreaker: "Páči sa mi váš web." } },
          { first_name: "Zuzana", last_name: "Testovacia", email: "zuzana.test@example.com", company_name: "Firma D", location: "Nitra", custom_fields: { icebreaker: "Skvelá práca v NR!" } },
          { first_name: "Robert", last_name: "Final", email: "robert.final@example.com", company_name: "Firma E", location: "Trnava", custom_fields: { icebreaker: "Pozdravujem do Trnavy." } }
      ];

      await axios.post(`${BASE_URL}/campaigns/${campaignId}/leads`, {
          lead_list: leads,
          settings: {
              ignore_global_block_list: true,
              ignore_unsubscribe_list: true,
              ignore_duplicate_leads_in_other_campaign: false
          }
      }, {
          params: { api_key: API_KEY }
      });
      console.log(`✅ ${leads.length} leadov pridaných.`);

      console.log(`\n🎉 HOTOVO! Kampaň "${campaignName}" je pripravená v Smartleade.`);
  } catch (err: any) {
      console.error("❌ CHYBA:", err.response?.data || err.message);
  }
}

testFullCampaign().catch(console.error).finally(() => process.exit(0));
