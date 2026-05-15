import { chromium } from "playwright";

// -------------------- SHEETS --------------------
const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

// -------------------- LIMITS (важно для стабильности) --------------------
const MAX_QUERIES = 5;
const MAX_LINKS = 1;
const MAX_COMMENTS = 10;
const TIMEOUT = 12000;

// -------------------- READ KEYWORDS --------------------
async function readKeywords() {
  const res = await fetch(SHEET_KEYWORDS);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  lines.shift();

  return lines
    .map(l => l.split(",")[0].replace(/"/g, "").trim())
    .filter(Boolean);
}

// -------------------- READ SITES --------------------
async function readSites() {
  const res = await fetch(SHEET_SITES);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  lines.shift();

  return lines
    .map(l => l.split(",")[0].replace(/"/g, "").trim())
    .filter(Boolean);
}

// -------------------- BUILD QUERIES --------------------
function buildSearchQueries(keywords, sites) {
  const out = [];

  for (const k of keywords) {
    for (const s of sites) {
      out.push(`${k} site:${s}`);
    }
  }

  return out;
}

// -------------------- SEARCH (DuckDuckGo HTML) --------------------
async function searchLinks(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const res = await fetch(url, { timeout: 10000 });
    const html = await res.text();

    const links = [...html.matchAll(/<a rel="nofollow" class="result__a" href="(.*?)"/g)]
      .map(m => m[1])
      .filter(Boolean);

    return links;
  } catch {
    return [];
  }
}

// -------------------- CLEAN URL --------------------
function cleanDuckUrl(url) {
  try {
    const match = url.match(/uddg=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : url;
  } catch {
    return url;
  }
}

// -------------------- YOUTUBE PARSER --------------------
async function parseYouTube(page, url, query) {
  console.log("YOUTUBE:", url);

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT
    });

    await page.waitForTimeout(2000);

    const title = await page.title().catch(() => "");

    const description = await page.evaluate(() => {
      const el = document.querySelector("#description");
      return el ? el.innerText : "";
    }).catch(() => "");

    const comments = await page.evaluate((max) => {
      const nodes = document.querySelectorAll("#content-text");
      return Array.from(nodes)
        .slice(0, max)
        .map(el => el.innerText.trim())
        .filter(Boolean);
    }, MAX_COMMENTS).catch(() => []);

    return {
      url,
      query,
      title,
      description,
      comments
    };

  } catch (e) {
    console.log("YOUTUBE ERROR:", e.message);
    return null;
  }
}

// -------------------- MAIN --------------------
(async () => {
  const keywords = await readKeywords();
  const sites = await readSites();

  const queries = buildSearchQueries(keywords, sites).slice(0, MAX_QUERIES);

  console.log("KEYWORDS:", keywords.length);
  console.log("SITES:", sites.length);
  console.log("QUERIES:", queries.length);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT);

  const results = [];

  for (const q of queries) {
    console.log("SEARCH:", q);

    const links = await searchLinks(q);

    for (const link of links.slice(0, MAX_LINKS)) {
      const cleanUrl = cleanDuckUrl(link);

      if (cleanUrl.includes("youtube.com/watch")) {
        const data = await parseYouTube(page, cleanUrl, q);

        if (data) {
          results.push(data);
          console.log("COMMENTS:", data.comments.length);
        }
      }
    }
  }

  await browser.close();

  console.log("FINAL SAMPLE:", results.slice(0, 3));
})();
