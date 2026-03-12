import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function debug() {
    const res = await axios.get('https://www.orsr.sk/vypis.asp?ID=753148&SID=2&P=0', { responseType: 'arraybuffer' });
    const html = iconv.decode(Buffer.from(res.data), 'win1250');
    const $ = cheerio.load(html);
    
    $("a").each((i, a) => {
        if ($(a).text().includes("Branislav")) {
            console.log(`LINK ${i}: CLASS=[${$(a).attr('class')}] TEXT=[${$(a).text().substring(0, 50).trim()}]`);
        }
    });

    console.log("TOTAL LNM CLASS ELEMENTS:", $(".lnm").length);
}

debug();
