const fs = require("fs");
const path = require("path");

const SITE_URL = process.env.SITE_URL || "https://now-in-korea-production.up.railway.app";
const OUT_PATH = path.join(__dirname, "..", "props.json");

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
  console.log(`[prepare-data] ${SITE_URL}/api/trends 에서 실시간 데이터 가져오는 중...`);
  const res = await fetch(`${SITE_URL}/api/trends`);
  if (!res.ok) throw new Error(`사이트 API 요청 실패: HTTP ${res.status}`);
  const data = await res.json();
  const asOf = formatAsOf(data.updatedAt);

  // 명령줄 인자로 순위를 지정할 수 있다: node src/prepare-data.js 2 → 2위 트렌드 선택 (기본값 1위)
  const rank = Number(process.argv[2]) || 1;
  const picked = data.trends.find((t) => t.rank === rank);
  if (!picked) throw new Error(`${rank}위 트렌드를 찾을 수 없습니다 (전체 ${data.trends.length}개)`);

  const summary = Array.isArray(picked.summary) ? picked.summary : [];
  const trend = {
    rank: picked.rank,
    keyword: picked.keyword,
    topic: picked.topic || picked.keyword,
    category: picked.category || null,
    tags: Array.isArray(picked.tags) ? picked.tags.slice(0, 3) : [],
    overview: picked.overview || "",
    bullets: summary.slice(0, 2).map((b) => ({ text: b.text, source: b.source })),
    asOf,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify({ trends: [trend] }, null, 2));
  console.log(`[prepare-data] props.json 생성 완료 (${trend.rank}위 "${trend.keyword}", 사이트 기준 ${asOf}): ${OUT_PATH}`);
})().catch((err) => {
  console.error("[prepare-data] 실패:", err.message);
  process.exit(1);
});
