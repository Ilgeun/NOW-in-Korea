const { XMLParser } = require("fast-xml-parser");

const xmlParser = new XMLParser({ ignoreAttributes: false });

// 구글 트렌드 RSS가 준 기사가 없거나 대상 언어가 아닐 수 있으므로,
// hl/gl/ceid로 지역·언어를 고정한 구글 뉴스 검색 결과를 보조 소스로 사용한다.
async function searchLocalNews(keyword, { hl, gl, ceid }, limit = 2) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = xmlParser.parse(xml);
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];
    const list = Array.isArray(items) ? items : [items];

    return list.slice(0, limit).map((item) => {
      const sourceName =
        (item.source && (item.source["#text"] || item.source)) || null;
      // 구글 뉴스 검색 결과 title은 보통 "헤드라인 - 언론사" 형태라 언론사명을 분리해준다.
      const rawTitle = String(item.title || "");
      const title = rawTitle.replace(new RegExp(`\\s*-\\s*${sourceName}$`), "").trim() || rawTitle;
      return {
        url: item.link || null,
        source: sourceName,
        text: title, // 전체 본문이 아니라 헤드라인만 확보 가능 (구글 뉴스 리다이렉트는 JS로만 풀림)
        headlineOnly: true,
      };
    });
  } catch (err) {
    console.error(`[news-search] "${keyword}" 검색 실패:`, err.message);
    return [];
  }
}

module.exports = { searchLocalNews };
