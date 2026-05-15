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

// ==================== CSV ====================

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

const readKeywords = () => readCsv(SHEET_KEYWORDS);
const readSites = () => readCsv(SHEET_SITES);

// ==================== QUERIES ====================

function buildQueries(keywords, sites) {
  const out = [];
  for (const k of keywords) {
    for (const s of sites) {
      out.push(`${k} site:${s}`);
    }
  }
  return out;
}

// ==================== SEARCH ====================

async function searchDuck(query) {
  const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);

  const res = await fetch(url);
  const html = await res.text();

  return [...html.matchAll(/<a rel="nofollow" class="result__a" href="(.*?)"/g)]
    .map(m => m[1])
    .map(cleanDuckUrl)
    .filter(Boolean)
    .filter(u => ALLOWED_SITES.some(s => u.includes(s)))
    .slice(0, 5);
}

function cleanDuckUrl(url) {
  try {
    const m = url.match(/uddg=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : url;
  } catch {
    return url;
  }
}

// ==================== WRITE ====================

async function writeResult(row) {
  await fetch(WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row)
  });
}

// ==================== MAIN ====================

(async () => {
  const keywords = await readKeywords();
  const sites = await readSites();

  const queries = buildQueries(keywords, sites);

  for (const q of queries) {
    const links = await searchDuck(q);

    for (const url of links) {
      await writeResult({
        keyword: q,
        site: "search",
        postUrl: url,
        commentUrl: "",
        comment: "",
        date: new Date().toISOString()
      });
    }
  }
})();
