require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env"), quiet: true });
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const PROPS_PATH = path.join(__dirname, "..", "props.json");
const OUT_DIR = path.join(__dirname, "..", "out");
const SITE_URL = process.env.SITE_URL || "https://now-in-korea-production.up.railway.app";
// 처음엔 안전하게 unlisted로 올리고, 확인 후 YouTube Studio에서 직접 공개로 전환하는 걸 권장.
const PRIVACY_STATUS = process.env.YOUTUBE_PRIVACY_STATUS || "unlisted";

function safeFileName(keyword) {
  return keyword.replace(/[^\w가-힣]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildMetadata(trend) {
  const tagsLine = (trend.tags || []).map((t) => `#${t}`).join(" ");
  const title = `${trend.topic} — 지금 화제인 이유 | NOW in Korea`.slice(0, 100);
  const description = [
    trend.overview || "",
    "",
    tagsLine,
    "",
    "더 자세한 기사와 실시간 인기 검색어는 NOW in Korea에서 확인하세요.",
    SITE_URL,
    "",
    "이 영상은 AI 기술로 제작되었으며, 사용된 이미지는 실제 사건 현장이 아닌 자료화면입니다.",
  ].join("\n");
  return { title, description, tags: (trend.tags || []).slice(0, 10) };
}

async function main() {
  const { trends } = JSON.parse(fs.readFileSync(PROPS_PATH, "utf-8"));
  const trend = trends[0];
  if (!trend) throw new Error("props.json에 트렌드가 없습니다");

  const fileName = `${trend.rank}-${safeFileName(trend.keyword)}.mp4`;
  const filePath = path.join(OUT_DIR, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`영상 파일이 없습니다: ${filePath} (npm run render 먼저 실행하세요)`);

  const oauth2Client = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  const { title, description, tags } = buildMetadata(trend);
  console.log(`[upload-youtube] "${title}" 업로드 중... (${fileName}, privacy=${PRIVACY_STATUS})`);

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title, description, tags, categoryId: "25" }, // 25 = News & Politics
      status: {
        privacyStatus: PRIVACY_STATUS,
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true, // "AI로 제작됨" 공개 라벨 자동 설정
      },
    },
    media: { body: fs.createReadStream(filePath) },
  });

  console.log(`[upload-youtube] 업로드 완료: https://youtu.be/${res.data.id}`);
}

main().catch((err) => {
  console.error("[upload-youtube] 실패:", err.errors || err.message);
  process.exit(1);
});
