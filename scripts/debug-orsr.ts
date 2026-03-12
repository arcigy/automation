import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function debugOrsr() {
    const res = await axios.get('https://www.orsr.sk/vypis.asp?ID=753148&SID=2&P=0', { responseType: 'arraybuffer' });
    const html = iconv.decode(Buffer.from(res.data), 'win1250');
    const $ = cheerio.load(html);
    
    $("table").each((i, table) => {
        const text = $(table).text();
        if (text.includes("Branislav")) {
            console.log(`--- TABLE ${i} ---`);
            console.log("TEXT:", text.substring(0, 200));
            console.log("HTML:", $(table).html()?.substring(0, 500));
        }
    });
}

debugOrsr();
