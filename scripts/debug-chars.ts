import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function debug() {
    const res = await axios.get('https://www.orsr.sk/vypis.asp?ID=753148&SID=2&P=0', { responseType: 'arraybuffer' });
    const html = iconv.decode(Buffer.from(res.data), 'win1250');
    const $ = cheerio.load(html);
    
    $("td").each((i, td) => {
        const text = $(td).text().trim();
        if (text.includes("Karpatské")) {
            console.log(`--- ADDRESS TD ${i} ---`);
            const raw = $(td).text();
            console.log("HEX:", Buffer.from(raw).toString('hex'));
            for (let j = 0; j < raw.length; j++) {
                console.log(`Char ${j}: ${raw[j]} (code: ${raw.charCodeAt(j)})`);
            }
        }
    });
}

debug();
