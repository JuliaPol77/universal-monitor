// ===================== SHEETS =====================
const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

// сюда вставь WebApp Google Apps Script (doPost)
const SHEET_WEBAPP_URL = "PASTE_WEBAPP_URL_HERE";

// ===================== UTILS =====================
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

function buildSearchQueries(keywords, sites, limit = 10) {
  const out = [];
  for (const k of keywords) {
    for (const s of sites) {
      out.push(`${k} ${s}`);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// ===================== DUCK SEARCH =====================
async function searchLinks(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const html = await res.text();

  return [...html.matchAll(/<a rel="nofollow" class="result__a" href="(.*?)"/g)]
    .map(m => m[1])
    .slice(0, 5);
}

function cleanUrl(url) {
  try {
    const match = url.match(/uddg=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : url;
  } catch {
    return url;
  }
}

// ===================== YOUTUBE VIDEO ID =====================
function getVideoId(url) {
  try {
    if (url.includes("v=")) return url.split("v=")[1].split("&")[0];
    if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split("?")[0];
    return null;
  } catch {
    return null;
  }
}

// ===================== DATE FILTER =====================
function isTodayOrYesterday(dateText) {
  if (!dateText) return false;
  const txt = dateText.toLowerCase();
  return txt.includes("ago") ||
    txt.includes("hour") ||
    txt.includes("minute") ||
    txt.includes("yesterday") ||
    txt.includes("today");
}

// ===================== PARSE COMMENTS (NO API) =====================
async function parseYouTubeComments(videoUrl, keyword, site) {
  const videoId = getVideoId(videoUrl);
  if (!videoId) return [];

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const html = await fetch(url).then(r => r.text()).catch(() => null);
  if (!html) return [];

  const jsonMatch = html.match(/ytInitialData\s*=\s*(\{.+?\});/s);
  if (!jsonMatch) return [];

  let data;
  try {
    data = JSON.parse(jsonMatch[1]);
  } catch {
    return [];
  }

  const comments =
    data?.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];

  const results = [];

  function walk(obj) {
    if (!obj || typeof obj !== "object") return;

    if (obj.commentRenderer) {
      const c = obj.commentRenderer;

      const text =
        c?.contentText?.runs?.map(r => r.text).join("") || "";

      const date =
        c?.publishedTimeText?.runs?.[0]?.text || "";

      const author =
        c?.authorText?.simpleText || "";

      const commentUrl =
        `https://www.youtube.com/watch?v=${videoId}`;

      if (
        text &&
        text.toLowerCase().includes(keyword.toLowerCase())
      ) {
        if (isTodayOrYesterday(date)) {
          results.push({
            keyword,
            site,
            videoUrl,
            commentUrl,
            text,
            date
          });
        }
      }
    }

    for (const k in obj) {
      walk(obj[k]);
    }
  }

  walk(comments);

  return results.slice(0, 20);
}

// ===================== SEND TO SHEET =====================
async function sendToSheet(rows) {
  if (!rows.length) return;

  await fetch(SHEET_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows })
  });
}

// ===================== POOL =====================
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

// ===================== MAIN =====================
(async () => {
  const keywords = await readKeywords();
  const sites = await readSites();

  const queries = buildSearchQueries(keywords, sites, 10);

  const allResults = [];

  await asyncPool(3, queries, async (q) => {
    const links = await searchLinks(q);

    await asyncPool(2, links, async (l) => {
      const url = cleanUrl(l);
      if (!url.includes("youtube.com/watch") && !url.includes("youtu.be")) return;

      const videoId = getVideoId(url);
      if (!videoId) return;

      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      for (const k of keywords) {
        const rows = await parseYouTubeComments(videoUrl, k, q);
        allResults.push(...rows);
      }
    });
  });

  await sendToSheet(allResults);

  console.log("DONE:", allResults.length);
})();
