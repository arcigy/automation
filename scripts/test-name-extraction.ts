import { orsrMasterLookup } from "../tools/scraping/orsr-scraper.tool";

async function testNameExtraction() {
  const icosToTest = ["35773278", "34151982", "52957764"]; // CAM s.r.o., BIGA, Top Autoservis
  
  for(const ico of icosToTest) {
      const res = await orsrMasterLookup({ico});
      console.log(`\nIČO: ${ico} -> Konateľ: ${res?.executives.join(", ")}`);
  }
}
testNameExtraction().catch(console.error);
