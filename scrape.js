// ==================== CONFIG ====================

const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzgv33XufOlfIQ4uRcW2cZfryqwjnfODx-k14erXh32Kqo7UFofTY4tz1pC9qBkuVc1hQ/exec";

// ==================== CSV ====================

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

const readKeywords = () => readCsv(SHEET_KEYWORDS);
const readSites = () => readCsv(SHEET_SITES);

// ==================== QUERIES ====================

function buildQueries(keywords, sites) {
  const out = [];
  for (const k of keywords) {
    for (const s of sites) {
      out.push(`${k} ${s}`);
    }
  }
  return out;
}

// ==================== DUCK SEARCH ====================

async function searchDuck(query) {
  try {
    const res = await fetch(
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query)
    );

    const html = await res.text();

    const matches = [
      ...html.matchAll(/<a rel="nofollow" class="result__a" href="(.*?)"/g),
    ];

    return matches
      .map((m) => m[1])
      .map(cleanDuckUrl)
      .filter((u) => u.includes("youtube.com/watch"))
      .slice(0, 5);
  } catch {
    return [];
  }
}

function cleanDuckUrl(url) {
  try {
    const m = url.match(/uddg=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : url;
  } catch {
    return url;
  }
}

// ==================== YOUTUBE COMMENTS (NO API KEY) ====================

function getVideoId(url) {
  return url.split("v=")[1]?.split("&")[0];
}

async function getComments(videoId) {
  try {
    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/next?key=AIzaSyDUMMY",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.2024",
            },
          },
          videoId,
        }),
      }
    );

    const data = await res.json();

    const sections =
      data?.contents?.twoColumnWatchNextResults?.results?.results?.contents ||
      [];

    const out = [];

    for (const s of sections) {
      const runs =
        s?.commentThreadRenderer?.comment?.commentRenderer?.contentText?.runs;

      const text = runs?.map((r) => r.text).join("");

      if (text) {
        out.push({
          text,
        });
      }
    }

    return out;
  } catch {
    return [];
  }
}

// ==================== WRITE ====================

async function writeResult(row) {
  await fetch(WEBAPP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(row),
  });
}

// ==================== MAIN ====================

(async () => {
  const keywords = await readKeywords();
  const sites = await readSites();

  const queries = buildQueries(keywords, sites);

  for (const query of queries) {
    const links = await searchDuck(query);

    for (const url of links) {
      const videoId = getVideoId(url);
      if (!videoId) continue;

      const comments = await getComments(videoId);

      for (const c of comments) {
        await writeResult({
          keyword: query,
          site: "youtube",
          postUrl: url,
          commentUrl: `https://www.youtube.com/watch?v=${videoId}`,
          comment: c.text,
          date: new Date().toISOString(),
        });
      }
    }
  }

  console.log("DONE");
})();
