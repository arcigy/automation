import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function debug() {
    const res = await axios.get('https://www.orsr.sk/vypis.asp?ID=753148&SID=2&P=0', { responseType: 'arraybuffer' });
    const html = iconv.decode(Buffer.from(res.data), 'win1250');
    const $ = cheerio.load(html);
    
    $("td").each((i, el) => {
        const text = $(el).text().trim();
        if (text.includes("Obchodné meno") || text.includes("Arcigy") || text.includes("Branislav")) {
            console.log(`TD ${i}: [${$(el).attr('class')}] [${$(el).attr('style')}] -> ${text.substring(0, 100)}`);
        }
    });
}

debug();
