const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";


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


// -------------------- ROUTER --------------------
function buildSearchQueries(keywords, sites) {
  const queries = [];

  for (const k of keywords) {
    for (const s of sites) {
      queries.push(`${k} ${s}`);
    }
  }

  return queries;
}


// -------------------- LINK --------------------
async function searchLinks(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url);
  const html = await res.text();

  const links = [...html.matchAll(/<a rel="nofollow" class="result__a" href="(.*?)"/g)]
    .map(m => m[1])
    .filter(Boolean);

  return links;
}
function cleanDuckUrl(url) {
  try {
    const match = url.match(/uddg=([^&]+)/);
    if (!match) return url;

    return decodeURIComponent(match[1]);
  } catch {
    return url;
  }
}


// -------------------- YOUTUBE --------------------
async function parseYouTube(page, url, query) {
  console.log("YOUTUBE PARSE:", url);

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // описание видео
  const title = await page.title();

  const description = await page.evaluate(() => {
    const el = document.querySelector("#description");
    return el ? el.innerText : "";
  });

  // комментарии (первые загруженные)
  const comments = await page.evaluate(() => {
    const nodes = document.querySelectorAll("#content-text");
    return Array.from(nodes)
      .slice(0, 20)
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

  const queries = buildSearchQueries(keywords, sites).slice(0, 20);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = [];

  for (const q of queries) {
    console.log("SEARCH:", q);

    const links = await searchLinks(q);

    for (const link of links.slice(0, 2)) {
      const cleanUrl = cleanDuckUrl(link);

      // пока делаем только YouTube
      if (cleanUrl.includes("youtube.com/watch")) {
        const data = await parseYouTube(page, cleanUrl, q);

        results.push(data);

        console.log("COMMENTS:", data.comments.length);
      }
    }
  }

  await browser.close();

  console.log("FINAL RESULTS SAMPLE:", results.slice(0, 2));
})();
