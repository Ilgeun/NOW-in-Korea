require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env"), quiet: true });
const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const { pcmToWav } = require("./pcm-to-wav");

const PROPS_PATH = path.join(__dirname, "..", "props.json");
const AUDIO_DIR = path.join(__dirname, "..", "public", "audio");
const MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const VOICE_NAME = process.env.GEMINI_TTS_VOICE || "Kore";
const SAMPLE_RATE = 24000;

function safeFileName(keyword) {
  return keyword.replace(/[^\w가-힣]+/g, "-").replace(/^-+|-+$/g, "");
}

function wavDurationSec(wavBuffer) {
  const dataBytes = wavBuffer.length - 44;
  return dataBytes / 2 / SAMPLE_RATE;
}

async function synthesize(ai, text) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: text,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
    },
  });
  const part = response.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) throw new Error("TTS 응답에 오디오 데이터가 없습니다");
  return Buffer.from(part.inlineData.data, "base64");
}

(async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const { trends } = JSON.parse(fs.readFileSync(PROPS_PATH, "utf-8"));
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  for (const trend of trends) {
    if (!Array.isArray(trend.script)) {
      throw new Error(`${trend.keyword}: script가 없습니다. npm run generate-script를 먼저 실행하세요.`);
    }
    console.log(`[generate-audio] (${trend.rank}위) ${trend.keyword} — 세그먼트 ${trend.script.length}개 음성 생성 중...`);

    for (let i = 0; i < trend.script.length; i++) {
      const seg = trend.script[i];
      const pcm = await synthesize(ai, seg.narration);
      const wav = pcmToWav(pcm, SAMPLE_RATE);
      const fileName = `${trend.rank}-${safeFileName(trend.keyword)}-seg${i}.wav`;
      fs.writeFileSync(path.join(AUDIO_DIR, fileName), wav);
      seg.audioFile = `audio/${fileName}`;
      seg.durationSec = wavDurationSec(wav);
      console.log(`  [${i + 1}/${trend.script.length}] ${fileName} (${seg.durationSec.toFixed(1)}초)`);
    }
  }

  fs.writeFileSync(PROPS_PATH, JSON.stringify({ trends }, null, 2));
  console.log(`[generate-audio] props.json에 오디오 정보 반영 완료`);
})().catch((err) => {
  console.error("[generate-audio] 실패:", err.message);
  process.exit(1);
});
