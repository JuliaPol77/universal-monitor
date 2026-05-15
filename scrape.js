import { chromium } from "playwright";

// -------------------- SHEETS --------------------
const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

// -------------------- READ SHEETS --------------------
async function readKeywords() {
  const res = await fetch(SHEET_KEYWORDS);
  const csv = await res.text();

  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map(l => l.split(",")[0].replace(/"/g, "").trim())
    .filter(Boolean);
}

async function readSites() {
  const res = await fetch(SHEET_SITES);
  const csv = await res.text();

  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map(l => l.split(",")[0].replace(/"/g, "").trim())
    .filter(Boolean);
}

// -------------------- BUILD QUERIES --------------------
function buildSearchQueries(keywords, sites) {
  const queries = [];

  for (const k of keywords) {
    for (const s of sites) {
      queries.push(`${k} site:${s}`);
    }
  }

  return queries;
}

// -------------------- DUCKDUCKGO SEARCH --------------------
async function searchLinks(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url);
  const html = await res.text();

  const links = [...html.matchAll(/<a rel="nofollow" class="result__a" href="(.*?)"/g)]
    .map(m => m[1]);

  return links.slice(0, 3);
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

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 15000
  });

  await page.waitForTimeout(1500);

  const title = await page.title();

  const description = await page.evaluate(() => {
    const el = document.querySelector("#description");
    return el ? el.innerText : "";
  });

  const comments = await page.evaluate(() => {
    const nodes = document.querySelectorAll("#content-text");
    return Array.from(nodes)
      .slice(0, 10)
      .map(el => el.innerText.trim())
      .filter(Boolean);
  });

  return {
    url,
    query,
    title,
    description,
    comments
  };
}

// -------------------- MAIN --------------------
(async () => {
  const keywords = await readKeywords();
  const sites = await readSites();

  console.log("KEYWORDS:", keywords.length);
  console.log("SITES:", sites.length);

  // ⚡ ЖЁСТКИЙ ЛИМИТ (чтобы не зависало)
  const queries = buildSearchQueries(keywords, sites).slice(0, 5);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = [];

  for (const q of queries) {
    console.log("SEARCH:", q);

    const links = await searchLinks(q);

    for (const link of links) {
      const cleanUrl = cleanDuckUrl(link);

      if (cleanUrl.includes("youtube.com/watch")) {
        try {
          const data = await parseYouTube(page, cleanUrl, q);
          results.push(data);

          console.log("COMMENTS:", data.comments.length);
        } catch (e) {
          console.log("SKIP VIDEO (error)");
        }
      }
    }
  }

  await browser.close();

  console.log("FINAL RESULTS SAMPLE:", results.slice(0, 3));
})();
