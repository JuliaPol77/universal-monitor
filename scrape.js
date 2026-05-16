// ==================== CONFIG ====================

const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzgv33XufOlfIQ4uRcW2cZfryqwjnfODx-k14erXh32Kqo7UFofTY4tz1pC9qBkuVc1hQ/exec";

const ALLOWED_SITES = [
  "rutube.ru",
  "dzen.ru",
  "vk.com",
  "ok.ru",
  "threads.net",
  "woman.ru",
  "babyblog.ru",
  "eva.ru",
  "otvet.mail.ru",
  "7ya.ru",
  "cosmo.ru",
  "lisa.ru",
  "womanhit.ru",
  "passion.ru",
  "mycharm.ru",
  "livejournal.com",
  "pikabu.ru",
  "vc.ru",
  "youtube.com"
];

// ==================== READ CSV ====================

async function readCsv(url) {
  const res = await fetch(url);
  const csv = await res.text();

  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map(line => line.split(",")[0]?.replace(/"/g, "").trim())
    .filter(Boolean);
}

async function readKeywords() {
  return readCsv(SHEET_KEYWORDS);
}

async function readSites() {
  return readCsv(SHEET_SITES);
}

// ==================== BUILD QUERIES ====================

function buildQueries(keywords, sites) {
  const queries = [];

  for (const keyword of keywords) {
    for (const site of sites) {
      const cleanSite = site.replace("site:", "").trim();
      queries.push(`${keyword} ${cleanSite}`);
    }
  }

  return queries;
}

// ==================== SEARCH (ONLY DDG SERP) ====================

async function searchDuck(query) {
  try {
    const url =
      "https://html.duckduckgo.com/html/?q=" +
      encodeURIComponent(query);

    const res = await fetch(url);
    const html = await res.text();

    const results = [...html.matchAll(
      /<a rel="nofollow" class="result__a" href="(.*?)">(.*?)<\/a>/g
    )];

    return results
      .map(r => {
        const url = cleanDuckUrl(r[1]);
        const title = cleanTitle(r[2]);

        return { url, title };
      })
      .filter(r => isAllowed(r.url))
      .slice(0, 10);

  } catch (e) {
    console.log("SEARCH ERROR:", e.message);
    return [];
  }
}

// ==================== CLEAN URL ====================

function cleanDuckUrl(url) {
  try {
    const match = url.match(/uddg=([^&]+)/);
    if (!match) return url;
    return decodeURIComponent(match[1]);
  } catch {
    return url;
  }
}

// ==================== CLEAN TITLE ====================

function cleanTitle(title) {
  return title
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ==================== FILTER ====================

function isAllowed(url) {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");

    return ALLOWED_SITES.some(site =>
      hostname === site || hostname.endsWith("." + site)
    );
  } catch {
    return false;
  }
}

// ==================== WRITE ====================

async function writeResult(row) {
  try {

    console.log("SENDING:", row);

    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(row),
    });

    console.log("STATUS:", res.status);

    const text = await res.text();

    console.log("RESPONSE:", text);

  } catch (e) {
    console.log("WRITE ERROR:", e.message);
  }
}

// ==================== SITE NAME ====================

function getSiteName(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "unknown";
  }
}

// ==================== MAIN ====================

(async () => {
  console.log("START");

  const keywords = await readKeywords();
  const sites = await readSites();

  const queries = buildQueries(keywords, sites);

  console.log("QUERIES:", queries.length);

  for (const query of queries) {

    console.log("SEARCH:", query);

    const results = await searchDuck(query);

    console.log("FOUND:", results.length);

    for (const item of results) {

      await writeResult({
        keyword: query,
        site: getSiteName(item.url),
        postUrl: item.url,
        title: item.title,
        date: new Date().toISOString()
      });

    }
  }

  console.log("DONE");
})();
