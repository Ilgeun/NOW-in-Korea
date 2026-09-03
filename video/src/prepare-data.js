const fs = require("fs");
const path = require("path");

const SITE_URL = process.env.SITE_URL || "https://now-in-korea-production.up.railway.app";
const OUT_PATH = path.join(__dirname, "..", "props.json");
const TOP_N = Number(process.env.VIDEO_TOP_N) || 1;

function formatAsOf(isoString) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).formatToParts(new Date(isoString));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const period = get("dayPeriod") === "PM" ? "오후" : "오전";
  return `${period} ${get("hour")}시 ${get("minute")}분 기준`;
}

(async () => {
  // 로컬 파일이 아니라 실제 배포된 사이트에서 지금 서빙 중인 데이터를 그대로 가져온다.
  // (로컬 캐시로 만들면 사이트에 실제로 뜨는 순위와 어긋날 수 있다.)
  console.log(`[prepare-data] ${SITE_URL}/api/trends 에서 실시간 데이터 가져오는 중...`);
  const res = await fetch(`${SITE_URL}/api/trends`);
  if (!res.ok) throw new Error(`사이트 API 요청 실패: HTTP ${res.status}`);
  const data = await res.json();
  const asOf = formatAsOf(data.updatedAt);

  const trends = data.trends.slice(0, TOP_N).map((t) => {
    const summary = Array.isArray(t.summary) ? t.summary : [];
    return {
      rank: t.rank,
      keyword: t.keyword,
      topic: t.topic || t.keyword,
      category: t.category || null,
      tags: Array.isArray(t.tags) ? t.tags.slice(0, 3) : [],
      overview: t.overview || "",
      bullets: summary.slice(0, 2).map((b) => ({ text: b.text, source: b.source })),
      asOf,
    };
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify({ trends }, null, 2));
  console.log(`[prepare-data] ${trends.length}개 트렌드로 props.json 생성 완료 (사이트 기준 ${asOf}): ${OUT_PATH}`);
})().catch((err) => {
  console.error("[prepare-data] 실패:", err.message);
  process.exit(1);
});
