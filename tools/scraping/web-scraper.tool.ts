import axios from "axios";
import * as cheerio from "cheerio";

export interface ScrapedData {
  url: string;
  title: string;
  text: string;
  emails: string[];
  links: string[];
}

export interface WebScraperInput {
  url: string;
  depth?: number; // How many internal pages to visit (0 = only home)
}

export async function webScraperTool(input: WebScraperInput): Promise<ScrapedData[]> {
  const visited = new Set<string>();
  const toVisit: string[] = [normalizeUrl(input.url)];
  const results: ScrapedData[] = [];
  const maxDepth = input.depth ?? 1; // Default to follow 1 level of internal links

  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  while (toVisit.length > 0 && results.length <= 5) { // Limit to 5 pages total to avoid bloat
    const currentUrl = toVisit.shift()!;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    try {
      const response = await axios.get(currentUrl, {
        headers: { "User-Agent": userAgent },
        timeout: 10000,
        validateStatus: (status) => status < 400
      });

      const $ = cheerio.load(response.data);
      
      // Remove noisy elements
      $("script, style, nav, footer, iframe, noscript").remove();

      const title = $("title").text().trim();
      const text = $("body").text().replace(/\s+/g, " ").trim();
      const emails = [...new Set(response.data.match(emailRegex) || [])] as string[];
      
      const links: string[] = [];
      if (results.length === 0) { // Only find internal links on the first page (homepage)
        $("a[href]").each((_, el) => {
          let href = $(el).attr("href");
          if (href) {
            try {
              const fullUrl = new URL(href, currentUrl).href;
              // Only follow same-domain links
              if (new URL(fullUrl).hostname === new URL(currentUrl).hostname) {
                // Focus on interesting pages
                const lower = fullUrl.toLowerCase();
                if (lower.includes("o-nas") || lower.includes("about") || lower.includes("kontakt") || lower.includes("team") || lower.includes("kontakt")) {
                    links.push(fullUrl);
                }
              }
            } catch (e) {}
          }
        });
        
        // Add promising internal links to queue
        const uniqueLinks = [...new Set(links)];
        toVisit.push(...uniqueLinks.slice(0, 3)); // Add up to 3 interesting pages
      }

      results.push({
        url: currentUrl,
        title,
        text: text.substring(0, 5000), // Limit text per page
        emails,
        links: results.length === 0 ? links : []
      });

    } catch (error: any) {
      console.error(`Failed to scrape ${currentUrl}: ${error.message}`);
    }
  }

  return results;
}

function normalizeUrl(url: string): string {
  if (!url.startsWith("http")) return `https://${url}`;
  return url;
}
