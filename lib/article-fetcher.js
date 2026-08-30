const MAX_TEXT_LENGTH = 6000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

async function fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchArticleText(url) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const html = await fetchOnce(url);
      const text = htmlToText(html).slice(0, MAX_TEXT_LENGTH);
      return text;
    } catch (err) {
      lastErr = err;
    }
  }
  console.error(`[article-fetcher] ${url} 가져오기 실패: ${lastErr?.message}`);
  return null;
}

async function attachArticleText(trends) {
  const jobs = [];
  for (const t of trends) {
    for (const n of t.newsUrls || []) {
      jobs.push(
        fetchArticleText(n.url).then((text) => {
          n.text = text;
        })
      );
    }
  }
  await Promise.all(jobs);
  return trends;
}

module.exports = { fetchArticleText, attachArticleText };
