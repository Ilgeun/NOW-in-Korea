require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env"), quiet: true });
const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const PROPS_PATH = path.join(__dirname, "..", "props.json");
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const OUTRO = {
  narration: "더 자세한 기사 내용과 실시간 이슈 지수는 NOW in Korea에서 확인하실 수 있습니다.",
  caption: "NOW in Korea 에서 더보기",
};

function buildPrompt(trend) {
  const facts = (trend.bullets || []).map((b) => `- ${b.text}`).join("\n") || `- ${trend.overview}`;
  return `너는 정통 언론사의 모바일 뉴스 숏폼(Shorts) 전문 에디터다. 아래 이슈를 신뢰감 있고 간결한 뉴스 브리핑 대본으로 만들어라.

[톤앤매너]
- 자극적이거나 가벼운 예능 억양 금지. 뉴스 앵커/아나운서가 전달하는 단정하고 명확한 어조("~했습니다", "~로 나타났습니다")를 써라.
- 신뢰감을 주는 리포팅 스타일로, 핵심 수치와 정확한 팩트 중심으로 구성해라.
- 기사를 그대로 낭독하지 말고, 핵심 수치·시장 전망을 스스로의 문장으로 요약해서 전달해라 (저작권 문제 방지를 위해 원문을 그대로 옮기지 마라).

[구조] 정확히 3개의 세그먼트를 만들어라.
1. 훅: 왜 지금 화제인지 한 문장으로 임팩트 있게 시작
2. 핵심 팩트 1: 가장 중요한 수치·사실 1~2문장
3. 핵심 팩트 2: 그다음으로 중요한 수치·사실이나 전망 1~2문장

각 세그먼트는 다음 세 필드를 가진다:
- narration: 실제로 읽을 대본 문장 (뉴스 앵커 톤, 1~2문장)
- caption: 화면에 인포그래픽처럼 크게 띄울 핵심 키워드/수치 (5~14자 내외 짧은 문구, 문장이 아니라 헤드라인 형태)
- imagePrompt: 화면에 함께 보여줄 "자료화면" 사진의 장면 소재 (영어 또는 한국어, 한 문장). 사람이 아니라 **장소나 사물** 위주로 묘사해라(예: 법원 건물 외관, 증권 시황판, 항구의 컨테이너선, 국회의사당, 병원 복도 등). 특정 실존 인물이나 이 사건의 구체적 현장을 그대로 재현하려 하지 말고, 이 사건과 막연히 관련된 일반적인 장소·사물만 짧게 묘사해라 (조명·색감·구도 등 촬영 스타일은 별도로 고정되어 있으니 여기서는 언급하지 마라).

[출력 형식]
다른 설명이나 코드펜스 없이 JSON만 출력해라: {"segments": [{"narration": "...", "caption": "...", "imagePrompt": "..."}, ...]}

[이슈 정보]
키워드: ${trend.keyword}
주제: ${trend.topic}
카테고리: ${trend.category || "미분류"}
핵심 사실:
${facts}`;
}

async function generateSegments(ai, trend) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildPrompt(trend),
    config: { responseMimeType: "application/json" },
  });
  const parsed = JSON.parse(response.text);
  if (!Array.isArray(parsed.segments)) throw new Error("segments 배열이 없습니다");
  return parsed.segments;
}

(async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const { trends } = JSON.parse(fs.readFileSync(PROPS_PATH, "utf-8"));

  for (const trend of trends) {
    console.log(`[generate-script] (${trend.rank}위) ${trend.keyword} 대본 생성 중...`);
    const segments = await generateSegments(ai, trend);

    // 나레이션 맨 첫 문장 앞에 "이 키워드가 트렌드에 처음 잡힌 시점"을 고정 문구로 붙인다
    // (AI가 매번 다르게 쓰지 않도록 코드에서 직접 붙임 — 화면 캡션에는 안 붙고 음성에만 반영됨).
    if (trend.issueTime && segments[0]) {
      segments[0].narration = `${trend.issueTime}, ${segments[0].narration}`;
    }

    trend.script = [...segments, OUTRO];
    console.log(`[generate-script] 완료: 세그먼트 ${trend.script.length}개`);
  }

  fs.writeFileSync(PROPS_PATH, JSON.stringify({ trends }, null, 2));
  console.log(`[generate-script] props.json에 대본 반영 완료`);
})().catch((err) => {
  console.error("[generate-script] 실패:", err.message);
  process.exit(1);
});
