const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzgv33XufOlfIQ4uRcW2cZfryqwjnfODx-k14erXh32Kqo7UFofTY4tz1pC9qBkuVc1hQ/exec";

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
