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


// -------------------- MAIN --------------------
(async () => {
  const keywords = await readKeywords();
  const sites = await readSites();

  const queries = buildSearchQueries(keywords, sites).slice(0, 200);

  console.log("KEYWORDS:", keywords.length);
  console.log("SITES:", sites.length);
  console.log("QUERIES TOTAL:", queries.length);
  console.log("SAMPLE:", queries.slice(0, 10));
})();
