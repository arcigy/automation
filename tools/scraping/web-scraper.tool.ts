import axios from "axios";
import * as cheerio from "cheerio";

export interface ScrapedData {
  url: string;
  title: string;
  text: string;
  emails: string[];
  phones: string[];
  links: string[];
}

export interface WebScraperInput {
  url: string;
  depth?: number;
}

// ─── Email extraction ────────────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const OBFUSCATED_EMAIL_PATTERNS = [
  // "jan.novak [at] firma.sk"
  /([a-zA-Z0-9._%+\-]+)\s*[\[\(]?\s*(?:at|AT|@)\s*[\]\)]?\s*([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g,
  // "jan.novak(zavinac)firma.sk"
  /([a-zA-Z0-9._%+\-]+)\s*(?:\(zavinac\)|\(at\)|\[at\])\s*([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g,
  // HTML encoded &#64; or &#x40;
];

function extractEmails(html: string, text: string): string[] {
  const found = new Set<string>();

  // Standard regex on raw HTML (catches mailto: and inline)
  const directMatches = html.match(EMAIL_REGEX) || [];
  for (const e of directMatches) {
    if (!e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".svg") && !e.includes("sentry") && !e.includes("example")) {
      found.add(e.toLowerCase().trim());
    }
  }

  // Obfuscated pattern 1: word [at] word.tld
  let m: RegExpExecArray | null;
  const p1 = /([a-zA-Z0-9._%+\-]+)\s*[\[\(]?\s*(?:at|AT)\s*[\]\)]?\s*([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;
  while ((m = p1.exec(text)) !== null) {
    found.add(`${m[1]}@${m[2]}`.toLowerCase());
  }

  // Obfuscated pattern 2: zavinac / (a) / [a]
  const p2 = /([a-zA-Z0-9._%+\-]+)\s*(?:\(zavinač\)|\(zavinac\)|\(a\)|\[a\]|\(at\))\s*([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  while ((m = p2.exec(text)) !== null) {
    found.add(`${m[1]}@${m[2]}`.toLowerCase());
  }

  // HTML entity decode: &#64; = @
  const decodedHtml = html.replace(/&#64;|&#x40;/gi, "@").replace(/&#46;|&#x2e;/gi, ".");
  const entityMatches = decodedHtml.match(EMAIL_REGEX) || [];
  for (const e of entityMatches) {
    if (!e.includes("example") && !e.includes("sentry")) {
      found.add(e.toLowerCase().trim());
    }
  }

  // Filter junk
  return [...found].filter(e => {
    const parts = e.split("@");
    if (parts.length !== 2) return false;
    const domain = parts[1];
    return domain.includes(".") && !domain.endsWith(".png") && !domain.endsWith(".jpg");
  });
}

// ─── Phone extraction ────────────────────────────────────────────────────────

function extractPhones(text: string): string[] {
  const found = new Set<string>();
  // Slovak/Czech phone patterns
  const phoneRegex = /(?:\+421|\+420|00421|00420)?\s*(?:\d[\s\-]?){8,11}\d/g;
  const matches = text.match(phoneRegex) || [];
  for (const p of matches) {
    const clean = p.replace(/\s+/g, " ").trim();
    if (clean.replace(/\D/g, "").length >= 9) found.add(clean);
  }
  return [...found].slice(0, 3);
}

// ─── Priority pages ──────────────────────────────────────────────────────────

const PRIORITY_KEYWORDS = [
  "kontakt", "contact", "o-nas", "o nas", "about", "team",
  "impressum", "impresum", "gdpr", "ochrana-udajov", "footer",
  "kto-sme", "kto sme", "nas", "spolocnost"
];

function isPriorityPage(url: string): boolean {
  const lower = url.toLowerCase();
  return PRIORITY_KEYWORDS.some(k => lower.includes(k));
}

// ─── Scraper ──────────────────────────────────────────────────────────────────

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function scrapePage(url: string): Promise<ScrapedData | null> {
  try {
    const res = await axios.get(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 12000,
      validateStatus: s => s < 400,
      maxRedirects: 5
    });

    const rawHtml = typeof res.data === "string" ? res.data : res.data.toString();
    const $ = cheerio.load(rawHtml);

    // Remove noisy elements but KEEP footer (contains IČO, email, address)
    $("script, style, iframe, noscript, svg, head").remove();

    const title = $("title").text().trim();
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();

    // Email: try from raw HTML (before cheerio strips attrs), then decoded text
    const emails = extractEmails(rawHtml, bodyText);
    const phones = extractPhones(bodyText);

    // Also specifically check mailto: links
    $("a[href^='mailto:']").each((_, el) => {
      const href = $(el).attr("href") || "";
      const email = href.replace("mailto:", "").split("?")[0].trim().toLowerCase();
      if (email && email.includes("@")) emails.push(email);
    });

    // Collect internal links — prioritize contact/about pages
    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const full = new URL(href, url).href;
        if (new URL(full).hostname !== new URL(url).hostname) return;
        if (full === url) return;
        links.push(full);
      } catch {}
    });

    return {
      url,
      title,
      text: bodyText.substring(0, 6000),
      emails: [...new Set(emails)],
      phones: [...new Set(phones)],
      links: [...new Set(links)]
    };
  } catch (err: any) {
    console.warn(`⚠️ Scrape zlyhal (${url}): ${err.message}`);
    return null;
  }
}

// ─── Main tool ────────────────────────────────────────────────────────────────

export async function webScraperTool(input: WebScraperInput): Promise<ScrapedData[]> {
  const baseUrl = normalizeUrl(input.url);
  const results: ScrapedData[] = [];
  const visited = new Set<string>();

  // ── LOOP 1: Homepage ──────────────────────────────────────────────────────
  console.log(`🌐 Scraping homepage: ${baseUrl}`);
  const homepage = await scrapePage(baseUrl);
  if (!homepage) {
    console.warn(`⚠️ Homepage scrape zlyhal.`);
    return [];
  }
  results.push(homepage);
  visited.add(baseUrl);

  // ── LOOP 2: Priority subpages (kontakt, o-nas, etc.) ─────────────────────
  const maxDepth = input.depth ?? 1;
  if (maxDepth > 0) {
    // Sort: priority pages first, then others
    const priorityLinks = homepage.links.filter(isPriorityPage);
    const otherLinks = homepage.links.filter(l => !isPriorityPage(l));
    const toVisit = [...priorityLinks, ...otherLinks].slice(0, 6);

    for (const link of toVisit) {
      if (visited.has(link) || results.length >= 6) break;
      visited.add(link);

      console.log(`🔗 Scraping podstránka: ${link}`);
      const page = await scrapePage(link);
      if (page) results.push(page);

      // Small delay to be polite
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // ── LOOP 3: Targeted email search — guess URLs for common pages ───────────
  const allEmails = results.flatMap(r => r.emails);
  if (allEmails.length === 0) {
    console.log(`📧 Žiadne emaily. Skúšam cieleně contact/kontakt stránky...`);
    const baseDomain = new URL(baseUrl).origin;
    const guessUrls = [
      `${baseDomain}/kontakt`,
      `${baseDomain}/contact`,
      `${baseDomain}/o-nas`,
      `${baseDomain}/about`,
      `${baseDomain}/kontakty`,
      `${baseDomain}/contacts`,
      `${baseDomain}/impressum`,
    ];

    for (const guessUrl of guessUrls) {
      if (visited.has(guessUrl)) continue;
      visited.add(guessUrl);

      const page = await scrapePage(guessUrl);
      if (!page) continue;

      results.push(page);
      console.log(`✅ Guess URL fungoval: ${guessUrl} → ${page.emails.join(", ")}`);

      // Stop early if we found emails
      if (page.emails.length > 0) break;
      await new Promise(r => setTimeout(r, 400));
    }
  }

  const finalEmails = [...new Set(results.flatMap(r => r.emails))];
  const finalPhones = [...new Set(results.flatMap(r => r.phones))];
  console.log(`📊 Scraping hotový: ${results.length} stránok, ${finalEmails.length} emailov, ${finalPhones.length} telefónov`);

  return results;
}

function normalizeUrl(url: string): string {
  if (!url.startsWith("http")) return `https://${url}`;
  // Remove trailing slash for consistency
  return url.replace(/\/$/, "");
}
