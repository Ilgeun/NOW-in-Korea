require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env"), quiet: true });
const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const PROPS_PATH = path.join(__dirname, "..", "props.json");
const IMAGE_DIR = path.join(__dirname, "..", "public", "images");
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

const SAFETY_PREFIX =
  "사실적인 뉴스 자료화면 스타일 사진. 특정 실존 인물의 얼굴이나 실제 사건 현장을 그대로 재현하지 말고, " +
  "아래 설명과 막연히 관련된 일반적이고 상징적인 장면으로만 표현해라. 세로 방향(9:16) 구도, 저널리즘적인 사실적 화질. " +
  "피사체(건물, 사물 등)를 화면 정중앙에 안정적으로 배치해라. " +
  "이미지 안에 어떠한 글자, 자막, 채널 로고, 방송사 워터마크, 시계나 시간 표시도 절대 넣지 마라 (자막/라벨은 나중에 별도로 합성한다): ";

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
