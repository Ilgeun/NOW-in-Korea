const fs = require("fs");
const path = require("path");
const { CURRENT } = require("../config");
const { fetchRawTrends } = require("../lib/trends-fetcher");
const { attachArticleText } = require("../lib/article-fetcher");
const { searchLocalNews } = require("../lib/news-search");

const DATA_DIR = path.join(__dirname, "..", "data");
const PENDING_PATH = path.join(DATA_DIR, "pending.json");

(async () => {
  try {
    const trends = await fetchRawTrends(CURRENT.trendsGeo, CURRENT.numberUnits);
    await attachArticleText(trends);

    const okCount = trends.reduce(
      (sum, t) => sum + (t.newsUrls || []).filter((n) => n.text).length,
      0
    );
    const totalCount = trends.reduce((sum, t) => sum + (t.newsUrls || []).length, 0);
    console.log(`[fetch-trends] (${CURRENT.code}) 기사 본문 가져오기: ${okCount}/${totalCount}건 성공`);

    // Trends RSS가 준 기사가 없거나 대상 언어가 아닐 수 있으므로,
    // 이 나라 언어/지역 뉴스 검색 결과를 항상 보조 후보로 추가해준다.
    const newsParams = { hl: CURRENT.newsHl, gl: CURRENT.newsGl, ceid: CURRENT.newsCeid };
    await Promise.all(
      trends.map(async (t) => {
        const local = await searchLocalNews(t.keyword, newsParams, 2);
        t.newsUrls = [...(t.newsUrls || []), ...local];
      })
    );
    console.log(`[fetch-trends] (${CURRENT.code}) 지역 뉴스 검색 보강 완료`);

    fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = { generatedAt: new Date().toISOString(), country: CURRENT.code, items: trends };
    fs.writeFileSync(PENDING_PATH, JSON.stringify(payload, null, 2));
    console.log(`[fetch-trends] pending.json 갱신 완료 (${trends.length}개, ${payload.generatedAt})`);
  } catch (err) {
    console.error("[fetch-trends] 실패:", err.message);
    process.exit(1);
  }
})();
