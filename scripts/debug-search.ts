import axios from "axios";
import iconv from "iconv-lite";

async function go() {
    const ico = "36248325";
    const res = await axios.post("https://www.orsr.sk/hladaj_ico.asp", `ICO=${ico}&SID=0&P=0`, {
        responseType: 'arraybuffer',
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    });
    console.log("POST res length:", res.data.length);
    const html = iconv.decode(Buffer.from(res.data), 'win1250');
    console.log(html.substring(0, 1000));
}
go();
