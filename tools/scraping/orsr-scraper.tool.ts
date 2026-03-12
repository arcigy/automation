import axios from "axios";
import * as cheerio from "cheerio";
import iconv from "iconv-lite";

export interface OrsrResult {
    companyName: string;
    executives: string[];
    partners: string[];
    address: string;
    ico: string;
    url: string;
    source: "orsr_ico" | "orsr_name" | "zrsr_name";
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function superClean(text: string): string {
    if (!text) return "";
    return text
        .replace(/[\n\r\t\u00A0]/g, " ")
        .replace(/\s+/g, " ")
        .split("(od:")[0]
        .split("(since:")[0]
        .split(" Vznik")[0]
        .split(" Vklad:")[0]
        .trim();
}

const BLACKLIST_WORDS = [
    "konatelia", "konatem", "konatel", "spolocnici", "statutarny", "datum",
    "members", "partner", "address", "sidlo", "ico", "zapisany"
];

/** True only if text looks like a personal name (2+ words, no digits, not a keyword) */
function isLikelyPersonName(name: string): boolean {
    if (!name || name.length < 5) return false;
    if (/\d/.test(name)) return false;                         // contains digit → date / code
    if (/^[^a-záéíóúäôžšýčťňľŕĺěA-ZÁÉÍÓÚÄÔŽŠÝČŤŇĽŔĹĚ]/.test(name)) return false; // starts with non-letter
    const words = name.trim().split(/\s+/);
    if (words.length < 2) return false;                        // single word — addresses, etc.
    const lower = name.toLowerCase();
    if (BLACKLIST_WORDS.some(w => lower.includes(w))) return false;
    return true;
}

function extractName(raw: string): string {
    const cleaned = superClean(raw);
    const match = cleaned.match(/^([^0-9/]+)/);
    if (!match) return cleaned;
    let name = match[1].trim();
    if (name.endsWith(",")) name = name.slice(0, -1);
    return name.trim();
}

/** Validates that ICO is 6-8 digits (Slovak format) */
export function isValidIco(ico: string): boolean {
    const clean = ico.replace(/\s/g, "");
    return /^\d{6,8}$/.test(clean);
}

const ORSR_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.orsr.sk/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "sk,cs;q=0.9,en;q=0.8"
};

/** Exponential backoff helper */
async function wait(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 3): Promise<Buffer> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await axios.get(url, {
                responseType: "arraybuffer",
                headers,
                timeout: 15000,
                validateStatus: s => s < 500
            });
            if (res.status === 429 || res.status === 503) {
                const delay = attempt * 5000;
                console.warn(`⏳ Rate limit (${res.status}) na ${url}. Čakám ${delay}ms...`);
                await wait(delay);
                continue;
            }
            return Buffer.from(res.data);
        } catch (e: any) {
            if (attempt === retries) throw e;
            const delay = attempt * 3000;
            console.warn(`⚠️ Fetch pokus ${attempt}/${retries} zlyhal pre ${url}: ${e.message}. Čakám ${delay}ms...`);
            await wait(delay);
        }
    }
    throw new Error(`All ${retries} retries exhausted for ${url}`);
}

// ─── Parse detail page ──────────────────────────────────────────────────────

function parseDetailPage(html: string, ico: string, detailUrl: string, source: OrsrResult["source"]): OrsrResult | null {
    const $ = cheerio.load(html);

    const result: OrsrResult = {
        companyName: "",
        executives: [],
        partners: [],
        address: "",
        ico,
        url: detailUrl,
        source
    };

    // Extract company name and address from labeled TDs
    const tds = $("td");
    tds.each((i, el) => {
        const text = $(el).text().trim().toLowerCase();
        if (text.includes("obchodné meno:") || text.includes("business name:")) {
            result.companyName = superClean(tds.eq(i + 1).text());
        }
        if (text.includes("sídlo:") || text.includes("registered office:")) {
            result.address = superClean(tds.eq(i + 1).text());
        }
        if (text.includes("iČo:") || text === "ičo:") {
            const rawIco = superClean(tds.eq(i + 1).text()).replace(/\s/g, "");
            if (isValidIco(rawIco) && !result.ico) result.ico = rawIco;
        }
    });

    const allElements = $("td").toArray();

    // Strategy A: find names via hladaj_osoba links + section lookup
    allElements.forEach((el, i) => {
        const text = $(el).text().trim();
        const hasPersonLink = $(el).find("a[href*='hladaj_osoba.asp']").length > 0;
        const looksLikeName = text.length > 5 && text === text.toUpperCase() && !text.includes(":");

        if (hasPersonLink || looksLikeName) {
            let section = "";
            for (let j = i - 1; j >= 0; j--) {
                const head = $(allElements[j]).text().toLowerCase();
                if (head.includes("statutárny") || head.includes("konateľ") || head.includes("konat") || head.includes("osoby oprávnené")) {
                    section = "execs"; break;
                }
                if (head.includes("spoločníci") || head.includes("partners") || head.includes("vlastník") || head.includes("member")) {
                    section = "partners"; break;
                }
                if (head.length > 5 && head === head.toUpperCase() && head.endsWith(":")) break;
            }
            let extractedRawName = text;
            const personLinks = $(el).find("a[href*='hladaj_osoba.asp']");
            if (personLinks.length > 0) {
                // If there is an 'a' tag, its text is EXACTLY just the person's name, no address!
                extractedRawName = personLinks.first().text().trim();
            }

            const name = extractName(extractedRawName);
            if (isLikelyPersonName(name) && !name.includes("Meno")) {
                if (section === "execs" && !result.executives.includes(name)) result.executives.push(name);
                if (section === "partners" && !result.partners.includes(name)) result.partners.push(name);
            }
        }
    });

    // Strategy B: fallback — direct link traversal
    if (result.executives.length === 0 && result.partners.length === 0) {
        $("a[href*='hladaj_osoba.asp']").each((_, a) => {
            const name = extractName($(a).text());
            if (name.length < 4 || name.includes("Meno")) return;
            let section = "";
            const allTdsArr = $("td").toArray() as any[];
            const elIdx = allTdsArr.indexOf($(a).closest("td")[0]);
            for (let i = elIdx - 1; i >= 0; i--) {
                const txt = $(allTdsArr[i]).text().toLowerCase();
                if (txt.includes("statutárny") || txt.includes("konateľ") || txt.includes("konat") || txt.includes("acting")) { section = "execs"; break; }
                if (txt.includes("spoločníci") || txt.includes("partner") || txt.includes("vlastník")) { section = "partners"; break; }
                if (txt.length > 5 && txt === txt.toUpperCase() && txt.endsWith(":")) break;
            }
            if (isLikelyPersonName(name) && !name.includes("Meno")) {
                if (section === "execs" && !result.executives.includes(name)) result.executives.push(name);
                if (section === "partners" && !result.partners.includes(name)) result.partners.push(name);
            }
        });
    }

    // Strategy C: if still empty, grab mixed-case name pairs near "Konateľ"
    if (result.executives.length === 0) {
        const fullText = $("body").text();
        const konatIdx = fullText.toLowerCase().indexOf("konateľ");
        if (konatIdx !== -1) {
            const snippet = fullText.substring(konatIdx, konatIdx + 400);
            const nameMatches = snippet.match(/\b[A-ZÁÉÍÓÚÄÔŽŠÝČŤŇĽŔĹĚ][a-záéíóúäôžšýčťňľŕĺě]+\s+[A-ZÁÉÍÓÚÄÔŽŠÝČŤŇĽŔĹĚ][a-záéíóúäôžšýčťňľŕĺě]+\b/g);
            if (nameMatches) {
                for (const m of nameMatches.slice(0, 2)) {
                    const n = m.trim();
                    if (isLikelyPersonName(n) && !result.executives.includes(n)) {
                        result.executives.push(n);
                    }
                }
            }
        }
    }

    // Return null only if we got nothing useful at all
    if (!result.companyName && result.executives.length === 0) return null;
    return result;
}

// ─── LOOP A: Search by IČO ───────────────────────────────────────────────────

export async function orsrGetByIco(ico: string): Promise<OrsrResult | null> {
    const cleanIco = ico.replace(/\s/g, "");
    if (!isValidIco(cleanIco)) {
        console.warn(`⚠️ IČO "${cleanIco}" má nesprávny formát — preskakujem.`);
        return null;
    }

    const searchUrls = [
        `https://www.orsr.sk/hladaj_ico.asp?ICO=${cleanIco}&SID=0`,
        `https://www.orsr.sk/vyhladavanie.asp?lan=sk&sco=ico&ico=${cleanIco}&sid=0`
    ];

    for (const url of searchUrls) {
        try {
            const buf = await fetchWithRetry(url, ORSR_HEADERS);
            const html = iconv.decode(buf, "win1250");
            const $ = cheerio.load(html);

            const detailLink = $('a:contains("Aktuálny")').attr("href")
                || $('a[href*="vypis.asp"]').first().attr("href");

            if (!detailLink) continue;

            const detailUrl = detailLink.startsWith("http") ? detailLink : `https://www.orsr.sk/${detailLink}`;
            const detailBuf = await fetchWithRetry(detailUrl, ORSR_HEADERS);
            const detailHtml = iconv.decode(detailBuf, "win1250");

            const result = parseDetailPage(detailHtml, cleanIco, detailUrl, "orsr_ico");
            if (result) return result;
        } catch (e: any) {
            console.warn(`⚠️ ORSR IČO lookup zlyhal pre ${url}: ${e.message}`);
        }
    }
    return null;
}

// ─── LOOP B: Search by Company Name in ORSR ──────────────────────────────────

export async function orsrGetByName(companyName: string): Promise<OrsrResult | null> {
    if (!companyName || companyName.trim().length < 3) return null;

    // Try with full name, then shortened (remove s.r.o., a.s., etc.)
    const namesToTry = [
        companyName.trim(),
        companyName.replace(/\s*(s\.r\.o\.|s\.r\.o|sro|a\.s\.|a\.s|spol\. s r\.o\.|k\.s\.|v\.o\.s\.)\s*$/i, "").trim()
    ].filter(Boolean);

    for (const name of namesToTry) {
        const encodedName = encodeURIComponent(name);
        const searchUrl = `https://www.orsr.sk/hladaj_subjekt.asp?OBMENO=${encodedName}&SID=0`;

        try {
            const buf = await fetchWithRetry(searchUrl, ORSR_HEADERS);
            const html = iconv.decode(buf, "win1250");
            const $ = cheerio.load(html);

            // Pick the first "Aktuálny" result
            const detailLink = $('a:contains("Aktuálny")').first().attr("href")
                || $('a[href*="vypis.asp"]').first().attr("href");

            if (!detailLink) {
                console.log(`🔍 ORSR meno "${name}": žiadné výsledky.`);
                continue;
            }

            const detailUrl = detailLink.startsWith("http") ? detailLink : `https://www.orsr.sk/${detailLink}`;
            const detailBuf = await fetchWithRetry(detailUrl, ORSR_HEADERS);
            const detailHtml = iconv.decode(detailBuf, "win1250");

            // Try to extract IČO from detail page
            const icoMatch = detailHtml.match(/\b\d{8}\b/);
            const foundIco = icoMatch ? icoMatch[0] : "";

            const result = parseDetailPage(detailHtml, foundIco, detailUrl, "orsr_name");
            if (result) {
                console.log(`✅ ORSR meno "${name}" → ${result.companyName}`);
                return result;
            }
        } catch (e: any) {
            console.warn(`⚠️ ORSR name lookup "${name}" zlyhal: ${e.message}`);
        }
    }
    return null;
}

// ─── LOOP C: Search by Name in ZRSR (Živnostenský register, for sole traders) ─

export async function zrsrGetByName(companyName: string): Promise<OrsrResult | null> {
    if (!companyName || companyName.trim().length < 3) return null;

    const cleanName = companyName
        .replace(/\s*(s\.r\.o\.|s\.r\.o|sro|a\.s\.|a\.s)\s*$/i, "")
        .trim();

    const searchUrl = `https://www.zrsr.sk/zr_vyhladavanie.aspx`;

    try {
        // ZRSR uses POST form
        const formData = new URLSearchParams({
            "ctl00$ContentPlaceHolder1$TextBoxObchodneMeno": cleanName,
            "ctl00$ContentPlaceHolder1$ButtonHladaj": "Hľadajte",
        });

        const res = await axios.post(searchUrl, formData.toString(), {
            headers: {
                ...ORSR_HEADERS,
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": "https://www.zrsr.sk/index"
            },
            timeout: 15000,
            responseType: "arraybuffer",
            validateStatus: s => s < 500
        });

        const html = iconv.decode(Buffer.from(res.data), "win1250");
        const $ = cheerio.load(html);

        // Find first result link
        const firstResultLink = $("a[href*='zr_vypis']").first().attr("href")
            || $("a[href*='zivnostnik']").first().attr("href");

        if (!firstResultLink) {
            console.log(`🔍 ZRSR "${cleanName}": žiadne výsledky.`);
            return null;
        }

        const detailUrl = firstResultLink.startsWith("http")
            ? firstResultLink
            : `https://www.zrsr.sk/${firstResultLink}`;

        const detailBuf = await fetchWithRetry(detailUrl, { ...ORSR_HEADERS, "Referer": "https://www.zrsr.sk/" });
        const detailHtml = iconv.decode(detailBuf, "win1250");
        const $d = cheerio.load(detailHtml);

        // ZRSR má jednoduchšiu štruktúru — parsujeme ručne
        const result: OrsrResult = {
            companyName: "",
            executives: [],
            partners: [],
            address: "",
            ico: "",
            url: detailUrl,
            source: "zrsr_name"
        };

        $d("table tr").each((_, row) => {
            const cells = $d(row).find("td");
            if (cells.length < 2) return;
            const label = cells.eq(0).text().toLowerCase().trim();
            const value = superClean(cells.eq(1).text());

            if (label.includes("obchodné meno") || label.includes("meno a priezv")) {
                result.companyName = value;
            }
            if (label.includes("sídlo") || label.includes("miesto podnikania")) {
                result.address = value;
            }
            if (label.includes("ičo")) {
                const icoClean = value.replace(/\s/g, "");
                if (isValidIco(icoClean)) result.ico = icoClean;
            }
            if (label.includes("meno a priezv") && !result.executives.includes(value)) {
                // ZRSR: živnostník je sám sebe konateľom
                result.executives.push(value);
            }
        });

        if (!result.companyName && !result.executives.length) return null;

        console.log(`✅ ZRSR "${cleanName}" → ${result.companyName || result.executives[0]}`);
        return result;
    } catch (e: any) {
        console.warn(`⚠️ ZRSR lookup "${cleanName}" zlyhal: ${e.message}`);
        return null;
    }
}

// ─── Master lookup — 2 pokusy o získanie konateľov ───────────────────────────
//
//  POKUS 1: Cez IČO  → orsrGetByIco(ico) → konatelia
//  POKUS 2: Cez meno → orsrGetByName(company s.r.o.) → konatelia
//  POKUS 3: ZRSR     → zrsrGetByName(meno) → živnostník
//
//  Každý pokus je nezávislý. Ak Pokus 1 vráti firmu bez konateľov,
//  Pokus 2 sa vždy spustí (s presnejším ORSR menom ak je dostupné).

export interface OrsrLookupInput {
    ico?: string | null;
    companyName?: string | null;
}

export async function orsrMasterLookup(input: OrsrLookupInput): Promise<OrsrResult | null> {
    const ico = input.ico?.replace(/\s/g, "") || null;
    const inputName = input.companyName?.trim() || null;

    let foundFromIco: OrsrResult | null = null;

    // ── POKUS 1: Hľadaj cez IČO ──────────────────────────────────────────────
    if (ico && isValidIco(ico)) {
        console.log(`🔍 [Pokus 1/IČO] Hľadám ${ico} v ORSR...`);
        foundFromIco = await orsrGetByIco(ico);

        if (foundFromIco) {
            console.log(`  → Firma: "${foundFromIco.companyName}" | Konatelia: ${foundFromIco.executives.length}`);

            if (foundFromIco.executives.length > 0 || foundFromIco.partners.length > 0) {
                // Konatelia nájdení cez IČO — hotovo
                return foundFromIco;
            }
            console.log(`  → Firma nájdená, ale bez konateľov. Skúšam Pokus 2 (meno)...`);
        } else {
            console.log(`  → IČO ${ico} nenájdené v ORSR.`);
        }
    } else if (ico) {
        console.log(`⚠️ [Pokus 1/IČO] IČO "${ico}" má nesprávny formát — preskakujem.`);
    }

    // ── POKUS 2: Hľadaj cez obchodné meno ────────────────────────────────────
    // Použijeme ORSR meno z Pokusu 1 ak je dostupné (presnejšie ako AI guess),
    // inak meno z inputu
    const nameForSearch = foundFromIco?.companyName || inputName;

    if (nameForSearch) {
        console.log(`🔍 [Pokus 2/Meno] Hľadám "${nameForSearch}" v ORSR...`);
        const foundFromName = await orsrGetByName(nameForSearch);

        if (foundFromName) {
            console.log(`  → Firma: "${foundFromName.companyName}" | Konatelia: ${foundFromName.executives.length}`);

            // Ak sme mali výsledok z Pokusu 1 (má IČO + adresu), mergujeme
            if (foundFromIco) {
                return {
                    ...foundFromName,
                    companyName: foundFromIco.companyName || foundFromName.companyName,
                    address:     foundFromIco.address     || foundFromName.address,
                    ico:         foundFromIco.ico         || foundFromName.ico,
                    source:      "orsr_ico",
                };
            }
            return foundFromName;
        }
        console.log(`  → "${nameForSearch}" nenájdené v ORSR.`);
    }

    // ── POKUS 3: ZRSR — živnostníci a fyzické osoby ──────────────────────────
    if (inputName) {
        console.log(`🔍 [Pokus 3/ZRSR] Hľadám "${inputName}" v živnostenskom registri...`);
        const foundFromZrsr = await zrsrGetByName(inputName);

        if (foundFromZrsr) {
            console.log(`  → ZRSR: "${foundFromZrsr.companyName || foundFromZrsr.executives[0]}"`);

            if (foundFromIco) {
                return {
                    ...foundFromZrsr,
                    address: foundFromIco.address || foundFromZrsr.address,
                    ico:     foundFromIco.ico     || foundFromZrsr.ico,
                };
            }
            return foundFromZrsr;
        }
        console.log(`  → Nenájdené ani v ZRSR.`);
    }

    // Aspoň vrátime čo sme mali z Pokusu 1 (firma + adresa bez konateľov)
    if (foundFromIco) {
        console.log(`⚠️ Vraciam výsledok Pokusu 1 bez konateľov (aspoň firma + adresa).`);
        return foundFromIco;
    }

    console.log(`❌ Firma nenájdená (IČO: ${ico}, Meno: ${inputName})`);
    return null;
}


