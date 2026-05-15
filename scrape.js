import { chromium } from "playwright";

// -------------------- CONFIG --------------------
const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

const MAX_QUERIES = 10;
const WORKERS = 3;
const TIMEOUT = 20000;
const MAX_LINKS = 2;

// -------------------- CACHE --------------------
const cache = new Map();

// -------------------- UTIL --------------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function safe(fn, retries = 2) {
  let lastErr;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await sleep(500 * (i + 1)); // backoff
    }
  }

  console.log("FAILED after retries:", lastErr.message);
  return null;
}

// -------------------- SHEETS --------------------
async function readCsv(url) {
  const res = await fetch(url);
  const csv = await res.text();

  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map(l => l.split(",")[0]?.replace(/"/g, "").trim())
    .filter(Boolean);
}

// -------------------- SEARCH --------------------
async function searchLinks(query) {
  if (cache.has(query)) return cache.get(query);

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const html = await res.text();

  const links = [...html.matchAll(/<a rel="nofollow" class="result__a" href="(.*?)"/g)]
    .map(m => m[1])
    .filter(Boolean);

  cache.set(query, links);

  return links;
}

function cleanDuckUrl(url) {
  try {
    const match = url.match(/uddg=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : url;
  } catch {
    return url;
  }
}

// -------------------- YOUTUBE --------------------
async function parseYouTube(browser, url, query) {
  const page = await browser.newPage();

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT,
    });

    const title = await page.title();

    const description = await page.evaluate(() => {
      const el = document.querySelector("#description");
      return el ? el.innerText : "";
    });

    const comments = await page.evaluate(() => {
      const nodes = document.querySelectorAll("#content-text");
      return Array.from(nodes)
        .slice(0, 10)
        .map(e => e.innerText.trim())
        .filter(Boolean);
    });

    await page.close();

    return { url, query, title, description, comments };

  } catch (e) {
    await page.close();
    return null;
  }
}

// -------------------- QUEUE --------------------
class Queue {
  constructor(items) {
    this.items = items;
    this.index = 0;
  }

  next() {
    if (this.index >= this.items.length) return null;
    return this.items[this.index++];
  }
}

// -------------------- WORKER --------------------
async function worker(id, queue, browser, results) {
  while (true) {
    const q = queue.next();
    if (!q) return;

    console.log(`Worker ${id} →`, q);

    const links = await safe(() => searchLinks(q));
    if (!links) continue;

    const youtubeLinks = links
      .map(cleanDuckUrl)
      .filter(u => u.includes("youtube.com/watch"))
      .slice(0, MAX_LINKS);

    for (const link of youtubeLinks) {
      const data = await safe(() => parseYouTube(browser, link, q));

      if (data) {
        results.push(data);
        console.log(`Worker ${id} OK →`, data.title?.slice(0, 50));
      }
    }
  }
}

// -------------------- MAIN --------------------
(async () => {
  const keywords = await readCsv(SHEET_KEYWORDS);
  const sites = await readCsv(SHEET_SITES);

  const queries = keywords.flatMap(k => sites.map(s => `${k} ${s}`))
    .slice(0, MAX_QUERIES);

  console.log("KEYWORDS:", keywords.length);
  console.log("SITES:", sites.length);
  console.log("QUERIES:", queries.length);

  const browser = await chromium.launch({
    headless: true
  });

  const queue = new Queue(queries);
  const results = [];

  const workers = [];

  for (let i = 0; i < WORKERS; i++) {
    workers.push(worker(i + 1, queue, browser, results));
  }

  await Promise.all(workers);

  await browser.close();

  console.log("\nFINAL RESULTS:", results.slice(0, 5));
})();
