import fetch from "node-fetch";

// -------------------- CONFIG --------------------

const SHEET_KEYWORDS =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=ключи";

const SHEET_SITES =
  "https://docs.google.com/spreadsheets/d/1GCInDCLc4h7xGekTAfAPeeY1vt0Gcv464dSLJi5MiAA/gviz/tq?tqx=out:csv&sheet=площадки";

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzmA9s0ZfO8pUjWmVKnC9qgtfhqBWtTPSpabdp5vQpsNtBHQ8LEmUzWbVJ99hWcwy-nng/exec";

// -------------------- READ CSV --------------------

async function readCsv(url) {
  const res = await fetch(url);
  const csv = await res.text();

  return csv
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => l.split(",")[0]?.replace(/"/g, "").trim())
    .filter(Boolean);
}

const readKeywords = () => readCsv(SHEET_KEYWORDS);
const readSites = () => readCsv(SHEET_SITES);

// -------------------- BUILD QUERIES --------------------

function buildSearchQueries(keywords, sites, limit = 20) {
  const out = [];

  for (const k of keywords) {
    for (const s of sites) {
      out.push(`${k} ${s}`);

      if (out.length >= limit) {
        return out;
      }
    }
  }

  return out;
}

// -------------------- SEARCH LINKS --------------------

async function searchLinks(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url);
  const html = await res.text();

  return [...html.matchAll(/<a rel="nofollow" class="result__a" href="(.*?)"/g)]
    .map((m) => m[1])
    .slice(0, 5);
}

function cleanDuckUrl(url) {
  try {
    const match = url.match(/uddg=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : url;
  } catch {
    return url;
  }
}

// -------------------- GET COMMENTS --------------------

async function getComments(videoId) {
  try {
    const watchHtml = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`
    ).then((r) => r.text());

    const apiKeyMatch = watchHtml.match(/"INNERTUBE_API_KEY":"(.*?)"/);

    if (!apiKeyMatch) {
      console.log("NO API KEY");
      return [];
    }

    const apiKey = apiKeyMatch[1];

    const tokenMatch = watchHtml.match(
      /"continuationCommand":{"token":"(.*?)"/
    );

    if (!tokenMatch) {
      console.log("NO COMMENT TOKEN");
      return [];
    }

    const continuation = tokenMatch[1];

    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/next?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.20240509.00.00",
            },
          },
          continuation,
        }),
      }
    );

    const json = await res.json();

    const text = JSON.stringify(json);

    const comments = [
      ...text.matchAll(/"contentText":\{"runs":\[\{"text":"(.*?)"\}\]/g),
    ]
      .map((m) => m[1])
      .filter(Boolean)
      .slice(0, 20);

    return comments;
  } catch (e) {
    console.log("COMMENTS ERROR", e.message);
    return [];
  }
}

// -------------------- WRITE TO SHEET --------------------

async function writeRow(row) {
  try {
    await fetch(WEBAPP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(row),
    });

    console.log("WRITTEN:", row.comment.slice(0, 40));
  } catch (e) {
    console.log("WRITE ERROR", e.message);
  }
}

// -------------------- ASYNC POOL --------------------

async function asyncPool(limit, items, fn) {
  const ret = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));

    ret.push(p);

    if (limit <= items.length) {
      const e = p.then(() =>
        executing.splice(executing.indexOf(e), 1)
      );

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

  const queries = buildSearchQueries(keywords, sites, 20);

  console.log("QUERIES:", queries.length);

  await asyncPool(3, queries, async (query) => {
    console.log("SEARCH:", query);

    const links = await searchLinks(query);

    await asyncPool(2, links, async (link) => {
      const cleanUrl = cleanDuckUrl(link);

      if (!cleanUrl.includes("youtube.com/watch")) return;

      console.log("VIDEO:", cleanUrl);

      const videoId = cleanUrl.split("v=")[1]?.split("&")[0];

      if (!videoId) return;

      const comments = await getComments(videoId);

      console.log("COMMENTS:", comments.length);

      for (const comment of comments) {
        await writeRow({
          keyword: query,
          site: "youtube",
          postUrl: cleanUrl,
          commentUrl: cleanUrl,
          comment,
          date: new Date().toISOString(),
        });
      }
    });
  });

  console.log("DONE");
})();
