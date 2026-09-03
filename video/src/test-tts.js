require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env"), quiet: true });
const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");

const MODEL = process.argv[2] || "gemini-2.5-flash-preview-tts";

(async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: "안녕하세요, 테스트입니다.",
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
      },
    },
  });

  console.log(JSON.stringify(response, null, 2).slice(0, 2000));

  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (part?.inlineData?.data) {
    const buf = Buffer.from(part.inlineData.data, "base64");
    fs.writeFileSync("test-audio.raw", buf);
    console.log("mimeType:", part.inlineData.mimeType, "bytes:", buf.length);
  } else {
    console.log("no inlineData found");
  }
})().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
