// ==================== CONFIG ====================

const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzgv33XufOlfIQ4uRcW2cZfryqwjnfODx-k14erXh32Kqo7UFofTY4tz1pC9qBkuVc1hQ/exec";

const ALLOWED_SITES = [
  "rutube.ru",
  "youtube.com",
   "dzen.ru",
  "vk.com",
  "ok.ru",
  "threads.net"
];

// ==================== READ CSV ====================

async function readCsv(url) {
  const res = await fetch(url);
  const csv = await res.text();

  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.split(",")[0]?.replace(/"/g, "").trim())
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
      queries.push(`${keyword} ${site}`);
    }
  }

  return queries;
}

// ==================== SEARCH ====================

async function searchDuck(query) {
  try {
    const url =
      "https://html.duckduckgo.com/html/?q=" +
      encodeURIComponent(query);

    const res = await fetch(url);

    const html = await res.text();

    const matches = [
      ...html.matchAll(
        /<a rel="nofollow" class="result__a" href="(.*?)"/g
      ),
    ];

    return matches
      .map((m) => m[1])
      .map(cleanDuckUrl)
      .filter(u => ALLOWED_SITES.some(s => u.includes(s)))
      .slice(0, 5);
  } catch (e) {
    console.log("SEARCH ERROR:", e.message);
    return [];
  }
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

// ==================== WRITE TO GOOGLE SHEET ====================

async function writeResult(row) {
  try {
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(row),
    });

    const text = await res.text();

    console.log("WRITE RESPONSE:", text);
  } catch (e) {
    console.log("WRITE ERROR:", e.message);
  }
}

// ==================== MAIN ====================

(async () => {
  console.log("START");

  const keywords = await readKeywords();
  const sites = await readSites();

  console.log("KEYWORDS:", keywords);
  console.log("SITES:", sites);

  const queries = buildQueries(keywords, sites);

  console.log("QUERIES:", queries.length);

  for (const query of queries) {
    console.log("SEARCH:", query);

    const links = await searchDuck(query);

    console.log("FOUND:", links.length);

    for (const url of links) {
      console.log("VIDEO:", url);

      await writeResult({
        keyword: query,
        site: "youtube",
        postUrl: url,
        commentUrl: "",
        comment: "",
        date: new Date().toISOString(),
      });
    }
  }

  console.log("DONE");
})();
