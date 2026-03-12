import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function debug() {
    const res = await axios.get('https://www.orsr.sk/vypis.asp?ID=753148&SID=2&P=0', { responseType: 'arraybuffer' });
    const html = iconv.decode(Buffer.from(res.data), 'win1250');
    const $ = cheerio.load(html);
    
    $("td").each((i, td) => {
        if ($(td).text().includes("Branislav")) {
            console.log(`--- TD ${i} ---`);
            console.log("PARENT TR HTML:", $(td).parent().html());
        }
    });
}

debug();
