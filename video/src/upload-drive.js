require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env"), quiet: true });
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const PROPS_PATH = path.join(__dirname, "..", "props.json");
const OUT_DIR = path.join(__dirname, "..", "out");
const FOLDER_NAME = "NOW in Korea Shorts";

function safeFileName(keyword) {
  return keyword.replace(/[^\w가-힣]+/g, "-").replace(/^-+|-+$/g, "");
}

async function findOrCreateFolder(drive) {
  const existing = await drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
  });
  if (existing.data.files.length > 0) return existing.data.files[0].id;

  const created = await drive.files.create({
    requestBody: { name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });
  console.log(`[upload-drive] "${FOLDER_NAME}" 폴더 새로 생성`);
  return created.data.id;
}

async function main() {
  const { trends } = JSON.parse(fs.readFileSync(PROPS_PATH, "utf-8"));
  const trend = trends[0];
  if (!trend) throw new Error("props.json에 트렌드가 없습니다");

  const fileName = `${trend.rank}-${safeFileName(trend.keyword)}.mp4`;
  const filePath = path.join(OUT_DIR, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`영상 파일이 없습니다: ${filePath}`);

  const oauth2Client = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: process.env.DRIVE_REFRESH_TOKEN });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const folderId = await findOrCreateFolder(drive);
  const dateStr = new Date().toISOString().slice(0, 10);
  const driveFileName = `${dateStr}_${fileName}`;

  console.log(`[upload-drive] "${driveFileName}" 백업 업로드 중...`);
  const res = await drive.files.create({
    requestBody: { name: driveFileName, parents: [folderId] },
    media: { mimeType: "video/mp4", body: fs.createReadStream(filePath) },
    fields: "id, webViewLink",
  });

  console.log(`[upload-drive] 백업 완료: ${res.data.webViewLink}`);
}

main().catch((err) => {
  console.error("[upload-drive] 실패:", err.errors || err.message);
  process.exit(1);
});
