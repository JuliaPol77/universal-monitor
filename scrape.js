import fetch from "node-fetch";

// ==================== CONFIG ====================

const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzmA9s0ZfO8pUjWmVKnC9qgtfhqBWtTPSpabdp5vQpsNtBHQ8LEmUzWbVJ99hWcwy-nng/exec";

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

async function readKeywords() {
  return readCsv(SHEET_KEYWORDS);
}

async function readSites() {
  return readCsv(SHEET_SITES);
}

// ==================== SEARCH ====================

function buildQueries(keywords, sites) {
  const arr = [];

  for (const keyword of keywords) {
    for (const site of sites) {
      arr.push(`${keyword} ${site}`);
    }
  }

  return arr;
}

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
      .filter((u) => u.includes("youtube.com/watch"))
      .slice(0, 3);
  } catch (e) {
    console.log("SEARCH ERROR", e.message);
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

// ==================== COMMENTS ====================

async function getComments(videoUrl) {
  try {
    const html = await fetch(videoUrl).then((r) => r.text());

    const comments = [];

    const regex =
      /"contentText":\{"runs":\[\{"text":"(.*?)"\}\]/g;

    const matches = [...html.matchAll(regex)];

    for (const m of matches) {
      const text = m[1];

      if (!text) continue;

      if (text.length < 3) continue;

      comments.push(text);
    }

    return comments.slice(0, 20);
  } catch (e) {
    console.log("COMMENT ERROR", e.message);
    return [];
  }
}

// ==================== WRITE ====================

async function writeResult(row) {
  try {
    await fetch(WEBAPP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(row),
    });

    console.log("WRITTEN");
  } catch (e) {
    console.log("WRITE ERROR", e.message);
  }
}

// ==================== MAIN ====================

(async () => {
  console.log("START");

  const keywords = await readKeywords();
  const sites = await readSites();

  console.log("KEYWORDS:", keywords.length);
  console.log("SITES:", sites.length);

  const queries = buildQueries(keywords, sites);

  console.log("QUERIES:", queries.length);

  for (const query of queries) {
    console.log("SEARCH:", query);

    const links = await searchDuck(query);

    console.log("FOUND LINKS:", links.length);

    for (const url of links) {
      console.log("VIDEO:", url);

      const comments = await getComments(url);

      console.log("COMMENTS:", comments.length);

      for (const comment of comments) {
        const row = {
          keyword: query,
          site: "youtube",
          postUrl: url,
          commentUrl: url,
          comment: comment,
          date: new Date().toISOString(),
        };

        await writeResult(row);
      }
    }
  }

  console.log("DONE");
})();
