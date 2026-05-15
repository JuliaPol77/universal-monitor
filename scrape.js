const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

async function readKeywords() {
  const res = await fetch(SHEET_URL);
  const csv = await res.text();

  const lines = csv.trim().split("\n");
  lines.shift(); // убираем заголовок

  const keywords = lines
    .map(l => l.split(",")[0].replace(/"/g, "").trim())
    .filter(Boolean);

  return keywords;
}
