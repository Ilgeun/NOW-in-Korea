require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env"), quiet: true });
const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");

const MODEL = process.argv[2] || "gemini-2.5-flash-image";

(async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents:
      "뉴스 삽화 스타일 일러스트: 항구에 정박한 대형 컨테이너선. 실존 인물이나 특정 로고 없이, 차분한 편집풍 디지털 일러스트로. 세로 방향 구도.",
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  console.log("parts:", parts.map((p) => Object.keys(p)));

  const imagePart = parts.find((p) => p.inlineData);
  if (imagePart) {
    const buf = Buffer.from(imagePart.inlineData.data, "base64");
    fs.writeFileSync("test-image.png", buf);
    console.log("mimeType:", imagePart.inlineData.mimeType, "bytes:", buf.length);
  } else {
    console.log("no image part found. full response text:", response.text);
  }
})().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
