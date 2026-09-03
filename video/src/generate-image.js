require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env"), quiet: true });
const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const PROPS_PATH = path.join(__dirname, "..", "props.json");
const IMAGE_DIR = path.join(__dirname, "..", "public", "images");
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

// 기사 내용이 뭐든 항상 같은 "촬영 스타일"이 나오도록, 매번 바뀌는 imagePrompt 앞에
// 고정된 구도/조명/색감/안전 규칙을 못박아 붙인다. 실제로 바뀌는 건 장면 소재뿐이다.
const SAFETY_PREFIX =
  "전문 통신사(로이터/AP 스타일) 저널리즘 사진. 아래 고정 규칙을 반드시 지켜라:\n" +
  "1) 사람 얼굴이 보이면 안 된다. 사람이 필요하면 뒷모습·실루엣·손 등 신원을 알 수 없는 형태로만 표현하거나, 아예 사람 없이 장소·사물만 보여줘라. 실존 인물의 얼굴이나 실제 사건 현장을 그대로 재현하지 마라 — 아래 설명과 막연히 관련된 일반적이고 상징적인 장면으로만 표현해라.\n" +
  "2) 피사체를 화면 정중앙에 배치하고, 화면 상단 20%와 하단 25%에는 자막이 겹치므로 그 구역엔 핵심 피사체를 두지 말고 여백/배경으로 비워둬라.\n" +
  "3) 자연광 느낌의 차분하고 균일한 조명, 과장 없는 다큐멘터리 톤.\n" +
  "4) 살짝 채도를 낮춘 중립적인 색감 — 방송 뉴스 그래픽 위에 얹어도 튀지 않는 차분한 톤.\n" +
  "5) 피사계 심도가 얕은(배경이 부드럽게 흐려진) 에디토리얼 사진 느낌. 눈높이 또는 살짝 위에서 내려다보는 카메라 각도.\n" +
  "6) 세로 방향(9:16) 구도.\n" +
  "7) 이미지 안에 어떠한 글자, 자막, 채널 로고, 방송사 워터마크, 시계나 시간 표시도 절대 넣지 마라 (자막/라벨은 나중에 별도로 합성한다).\n" +
  "이 사진의 구체적인 장면 소재: ";

function safeFileName(keyword) {
  return keyword.replace(/[^\w가-힣]+/g, "-").replace(/^-+|-+$/g, "");
}

async function synthesizeImage(ai, imagePrompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: SAFETY_PREFIX + imagePrompt,
  });
  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart) throw new Error("이미지 응답에 inlineData가 없습니다");
  return Buffer.from(imagePart.inlineData.data, "base64");
}

(async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const { trends } = JSON.parse(fs.readFileSync(PROPS_PATH, "utf-8"));
  fs.mkdirSync(IMAGE_DIR, { recursive: true });

  for (const trend of trends) {
    if (!Array.isArray(trend.script)) {
      throw new Error(`${trend.keyword}: script가 없습니다. npm run generate-script를 먼저 실행하세요.`);
    }
    console.log(`[generate-image] (${trend.rank}위) ${trend.keyword} 이미지 생성 중...`);

    for (let i = 0; i < trend.script.length; i++) {
      const seg = trend.script[i];
      if (!seg.imagePrompt) continue; // 아웃트로 등 이미지가 필요 없는 세그먼트는 건너뜀

      const buf = await synthesizeImage(ai, seg.imagePrompt);
      const fileName = `${trend.rank}-${safeFileName(trend.keyword)}-seg${i}.png`;
      fs.writeFileSync(path.join(IMAGE_DIR, fileName), buf);
      seg.imageFile = `images/${fileName}`;
      console.log(`  [${i + 1}/${trend.script.length}] ${fileName}`);
    }
  }

  fs.writeFileSync(PROPS_PATH, JSON.stringify({ trends }, null, 2));
  console.log(`[generate-image] props.json에 이미지 정보 반영 완료`);
})().catch((err) => {
  console.error("[generate-image] 실패:", err.message);
  process.exit(1);
});
