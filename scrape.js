// ===================== SHEETS =====================
const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

const SHEET_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzmA9s0ZfO8pUjWmVKnC9qgtfhqBWtTPSpabdp5vQpsNtBHQ8LEmUzWbVJ99hWcwy-nng/exec";

// ===================== READ =====================
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

// ===================== SEARCH =====================
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

async function searchLinks(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetch(url).then(r => r.text());

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

// ===================== VIDEO ID =====================
function getVideoId(url) {
  try {
    if (url.includes("v=")) return url.split("v=")[1].split("&")[0];
    if (url.includes("youtu.be/")) return url.split("youtu.be/")[1].split("?")[0];
    return null;
  } catch {
    return null;
  }
}

// ===================== YOUTUBE COMMENTS =====================
async function fetchComments(videoId) {
  const url = `https://www.youtube.com/youtubei/v1/next?key=`;

  const body = {
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.2024.01"
      }
    },
    videoId
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  return await res.json().catch(() => null);
}

// ===================== EXTRACT COMMENTS =====================
function extractComments(json, videoId) {
  const rows = [];

  const walk = (obj) => {
    if (!obj || typeof obj !== "object") return;

    if (obj.commentRenderer) {
      const c = obj.commentRenderer;

      const text =
        c?.contentText?.runs?.map(r => r.text).join("") || "";

      const commentId = c?.commentId || "";

      const date =
        c?.publishedTimeText?.runs?.[0]?.text || "";

      rows.push([
        "",                    // ключ (пока пусто)
        "youtube",
        `https://www.youtube.com/watch?v=${videoId}`,
        commentId,
        text,
        date
      ]);
    }

    for (const k in obj) walk(obj[k]);
  };

  walk(json);

  return rows;
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

  const queries = buildSearchQueries(keywords, sites, 5);

  const allRows = [];

  await asyncPool(3, queries, async (q) => {
    const links = await searchLinks(q);

    await asyncPool(2, links, async (l) => {
      const url = cleanUrl(l);
      const videoId = getVideoId(url);
      if (!videoId) return;

      const json = await fetchComments(videoId);
      if (!json) return;

      const rows = extractComments(json, videoId);
      allRows.push(...rows);
    });
  });

  await sendToSheet(allRows);

  console.log("DONE:", allRows.length);
})();
