import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function debug() {
    const res = await axios.get('https://www.orsr.sk/vypis.asp?ID=753148&SID=2&P=0', { responseType: 'arraybuffer' });
    const html = iconv.decode(Buffer.from(res.data), 'win1250');
    const $ = cheerio.load(html);
    
    $("tr").each((i, tr) => {
        if ($(tr).text().includes("Branislav")) {
            console.log(`--- ROW ${i} ---`);
            console.log("HTML:", $(tr).html());
        }
    });

    console.log("\n--- BT Class Elements ---");
    $(".BT").each((i, el) => {
        console.log(`BT ${i}:`, $(el).text().trim());
    });
}

debug();
