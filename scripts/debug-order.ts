import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function debug() {
    const res = await axios.get('https://www.orsr.sk/vypis.asp?ID=753148&SID=2&P=0', { responseType: 'arraybuffer' });
    const html = iconv.decode(Buffer.from(res.data), 'win1250');
    const $ = cheerio.load(html);
    
    // Iterate through all elements that might be headers or data
    $("td, a").each((i, el) => {
        const text = $(el).text().trim();
        if (text.includes("Statutárny") || 
            text.includes("Konatelia") || 
            text.includes("Spoločníci") || 
            text.includes("Laubert") || 
            text.includes("Repický")) {
            console.log(`${i}: [${$(el).prop("tagName")}] -> ${text.substring(0, 50)}`);
        }
    });
}

debug();
