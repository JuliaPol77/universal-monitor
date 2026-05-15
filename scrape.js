import { chromium } from "@playwright/test";

// -------------------- CONFIG --------------------
const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

const MAX_QUERIES = 10;        // ограничение нагрузки
const MAX_LINKS = 1;           // только 1 ссылка на запрос
const MAX_COMMENTS = 10;       // меньше → быстрее
const PAGE_TIMEOUT = 12000;    // защита от зависаний

// -------------------- KEYWORDS --------------------
async function readKeywords() {
  const res = await fetch(SHEET_KEYWORDS);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  lines.shift();

  return lines
    .map(l => l.split(",")[0].replace(/"/g, "").trim())
    .filter(Boolean);
}

// -------------------- SITES --------------------
async function readSites() {
  const res = await fetch(SHEET_SITES);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  lines.shift();

  return lines
    .map(l => l.split(",")[0].replace(/"/g, "").trim())
    .filter(Boolean);
}

// -------------------- SEARCH QUERIES --------------------
function buildSearchQueries(keywords, sites) {
  const queries = [];

  for (const k of keywords) {
    for (const s of sites) {
      queries.push(`${k} site:${s}`);
    }
  }

  return queries;
}

// -------------------- SEARCH --------------------
async function searchLinks(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const res = await fetch(url, { timeout: 10000 });
    const html = await res.text();

    const links = [...html.matchAll(/<a rel="nofollow" class="result__a" href="(.*?)"/g)]
      .map(m => m[1])
      .filter(Boolean);

    return links;
  } catch (e) {
    console.log("SEARCH ERROR:", e.message);
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

// -------------------- YOUTUBE PARSER (SAFE) --------------------
async function parseYouTube(page, url, query) {
  console.log("YOUTUBE:", url);

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT
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
  page.setDefaultTimeout(PAGE_TIMEOUT);

  const results = [];

  for (const q of queries) {
    console.log("SEARCH:", q);

    const links = await searchLinks(q);

    const limitedLinks = links.slice(0, MAX_LINKS);

    for (const link of limitedLinks) {
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
