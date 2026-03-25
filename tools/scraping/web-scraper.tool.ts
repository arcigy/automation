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

import { chromium } from "playwright";

// --- Blacklist (avoid portals and social media) ---
const DOMAIN_BLACKLIST = [
  "facebook.com", "instagram.com", "linkedin.com", "linkedin.sk", "twitter.com", "x.com", 
  "youtube.com", "tiktok.com", "bazos.sk", "zoznam.sk", "firmy.sk", "azet.sk", "pinterest.com",
  "webnode.sk", "webnode.com", // (some are okay but often low quality)
  "google.com", "google.sk", "mapy.cz"
];

function isBlacklisted(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return DOMAIN_BLACKLIST.some(d => hostname.endsWith(d));
  } catch {
    return true;
  }
}

async function scrapeWithPlaywright(url: string): Promise<ScrapedData | null> {
  console.log(`🌐 [JS Fallback] Initializing Playwright for: ${url}`);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();
    
    // Go to URL and wait for meaningful content
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    
    // Smooth scroll to bottom (triggers lazy-loaded elements)
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        let distance = 100;
        let timer = setInterval(() => {
          let scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if(totalHeight >= scrollHeight){
            clearInterval(timer);
            resolve(true);
          }
        }, 100);
      });
    });

    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body.innerText);
    const html = await page.content();

    const emails = extractEmails(html, bodyText);
    const phones = extractPhones(bodyText);

    return {
      url,
      title,
      text: bodyText.substring(0, 8000),
      emails: [...new Set(emails)],
      phones: [...new Set(phones)],
      links: [] // We don't need sublinks from the browser fallback usually
    };
  } catch (err: any) {
    console.warn(`⚠️ Playwright zlyhal (${url}): ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

export async function webScraperTool(input: WebScraperInput): Promise<ScrapedData[]> {
  const baseUrl = normalizeUrl(input.url);
  
  if (isBlacklisted(baseUrl)) {
    console.log(`🚫 Domain blacklisted (Portal/Social): ${baseUrl}`);
    return [];
  }

  const results: ScrapedData[] = [];
  const visited = new Set<string>();

  // ── LOOP 1: Homepage (Fast Axios) ─────────────────────────────────────────
  console.log(`🌐 Scraping homepage: ${baseUrl}`);
  const homepage = await scrapePage(baseUrl);
  
  if (homepage) {
    results.push(homepage);
    visited.add(baseUrl);
  }

  // ── LOOP 2: Priority subpages (Fast Axios) ─────────────────────────────────
  const maxDepth = input.depth ?? 1;
  if (homepage && maxDepth > 0) {
    const priorityLinks = homepage.links.filter(isPriorityPage);
    const otherLinks = homepage.links.filter(l => !isPriorityPage(l));
    const toVisit = [...priorityLinks, ...otherLinks].slice(0, 5);

    for (const link of toVisit) {
      if (visited.has(link) || results.length >= 6) break;
      visited.add(link);
      console.log(`🔗 Scraping podstránka: ${link}`);
      const page = await scrapePage(link);
      if (page) results.push(page);
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // ── LOOP 3: Playwright Fallback (If no emails found yet) ────────────────────
  const allEmails = [...new Set(results.flatMap(r => r.emails))];
  if (allEmails.length === 0) {
    console.log(`📉 Žiadne emaily po rýchlom scrape. Spúšťam Playwright Fallback...`);
    const jsResult = await scrapeWithPlaywright(baseUrl);
    if (jsResult && (jsResult.emails.length > 0 || jsResult.phones.length > 0)) {
       console.log(`✅ [JS Fallback] Úspech! Našiel ${jsResult.emails.length} emailov.`);
       results.push(jsResult);
    }
  }

  // ── LOOP 4: Targeted email search (Guess check) ───────────────────────────
  if ([...new Set(results.flatMap(r => r.emails))].length === 0) {
    console.log(`📧 Stále žiadne emaily. Skúšam cielené guess URLs...`);
    const baseDomain = new URL(baseUrl).origin;
    const guessUrls = [`${baseDomain}/kontakt`, `${baseDomain}/contact`, `${baseDomain}/o-nas`, `${baseDomain}/about`];

    for (const guessUrl of guessUrls) {
      if (visited.has(guessUrl)) continue;
      visited.add(guessUrl);
      const page = await scrapePage(guessUrl);
      if (page) {
        results.push(page);
        if (page.emails.length > 0) break;
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return results;
}

function normalizeUrl(url: string): string {
  if (!url.startsWith("http")) return `https://${url}`;
  // Remove trailing slash for consistency
  return url.replace(/\/$/, "");
}
