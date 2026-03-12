import axios from 'axios';
import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';

async function debug() {
    const res = await axios.get('https://www.orsr.sk/vypis.asp?ID=753148&SID=2&P=0', { responseType: 'arraybuffer' });
    const html = iconv.decode(Buffer.from(res.data), 'win1250');
    const $ = cheerio.load(html);
    
    $("tr").each((i, tr) => {
        const text = $(tr).text().trim();
        if (text.includes("Statutárny") || text.includes("Konatelia") || text.includes("Konateľ")) {
            console.log(`--- ROW ${i} ---`);
            console.log("TEXT:", text.substring(0, 100));
            console.log("CLASSES:", $(tr).find('td').map((_, td) => $(td).attr('class')).get());
        }
    });

    // Find all links again and their parent HTML
    $("a").each((i, a) => {
        if ($(a).text().includes("Laubert") || $(a).text().includes("Repický")) {
            console.log(`LINK ${i}:`, $(a).text().trim());
            console.log("PARENT TR TEXT:", $(a).closest("tr").text().trim().substring(0, 100));
        }
    });
}

debug();
