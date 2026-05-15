const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzmA9s0ZfO8pUjWmVKnC9qgtfhqBWtTPSpabdp5vQpsNtBHQ8LEmUzWbVJ99hWcwy-nng/exec";

(async () => {
  console.log("TEST WRITE START");

  const row = {
    keyword: "TEST",
    site: "youtube",
    postUrl: "https://youtube.com/test",
    commentUrl: "",
    comment: "HELLO TEST",
    date: new Date().toISOString(),
  };

  try {
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(row),
    });

    const text = await res.text();

    console.log("RESPONSE:");
    console.log(text);
  } catch (e) {
    console.log("ERROR:");
    console.log(e.message);
  }

  console.log("TEST END");
})();
