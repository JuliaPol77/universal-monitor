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


// -------------------- MAIN --------------------
(async () => {
  const keywords = await readKeywords();
  const sites = await readSites();

  const queries = buildSearchQueries(keywords, sites).slice(0, 50);

  console.log("TOTAL QUERIES:", queries.length);

  const allResults = [];

  for (const q of queries) {
    console.log("SEARCH:", q);

    try {
      const links = await searchLinks(q);

      for (const link of links.slice(0, 3)) {
        allResults.push({
          query: q,
          url: link
        });
      }
    } catch (e) {
      console.log("ERROR:", q);
    }
  }

  console.log("RESULTS:", allResults.slice(0, 10));
})();
