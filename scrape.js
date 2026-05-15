// -------------------- SHEETS --------------------
const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

// -------------------- READERS --------------------
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

// -------------------- QUERIES --------------------
function buildSearchQueries(keywords, sites, limit = 5) {
  const out = [];
  for (const k of keywords) {
    for (const s of sites) {
      out.push(`${k} ${s}`);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// -------------------- DUCKDUCKGO --------------------
async function searchLinks(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url);
  const html = await res.text();

  return [...html.matchAll(/<a rel="nofollow" class="result__a" href="(.*?)"/g)]
    .map(m => m[1])
    .slice(0, 3);
}

function cleanDuckUrl(url) {
  try {
    const match = url.match(/uddg=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : url;
  } catch {
    return url;
  }
}

// -------------------- FAST YOUTUBE (NO PLAYWRIGHT) --------------------
async function parseYouTube(url, query) {
  try {
    const videoId = url.split("v=")[1]?.split("&")[0];

    if (!videoId) return null;

    // лёгкий metadata fetch (очень быстрый)
    const oembed = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    ).then(r => r.json()).catch(() => null);

    return {
      url,
      query,
      title: oembed?.title || "",
      author: oembed?.author_name || "",
      comments: [] // ⚠️ fast mode: без тяжёлого DOM
    };

  } catch {
    return null;
  }
}

// -------------------- PARALLEL LIMIT --------------------
async function asyncPool(limit, items, fn) {
  const ret = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    ret.push(p);

    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(ret);
}

// -------------------- MAIN --------------------
(async () => {
  const keywords = await readKeywords();
  const sites = await readSites();

  console.log("KEYWORDS:", keywords.length);
  console.log("SITES:", sites.length);

  const queries = buildSearchQueries(keywords, sites, 5);
  console.log("QUERIES:", queries.length);

  const results = [];

  // параллельные поиски
  await asyncPool(3, queries, async (q) => {
    console.log("SEARCH:", q);

    const links = await searchLinks(q);

    await asyncPool(2, links, async (link) => {
      const cleanUrl = cleanDuckUrl(link);

      if (!cleanUrl.includes("youtube.com/watch")) return;

      const data = await parseYouTube(cleanUrl, q);
      if (data) {
        results.push(data);
        console.log("YOUTUBE OK:", data.title);
      }
    });
  });

  console.log("FINAL:", results.slice(0, 3));
})();
