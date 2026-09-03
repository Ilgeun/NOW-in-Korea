require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env"), quiet: true });
const http = require("http");
const { google } = require("googleapis");

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // 이미 예전에 승인한 적 있어도 refresh_token을 다시 받기 위함
  scope: ["https://www.googleapis.com/auth/youtube.upload"],
});

console.log("\n아래 URL을 브라우저에서 열고, 영상 올릴 채널 계정으로 로그인해서 승인해주세요:\n");
console.log(authUrl);
console.log("\n승인하면 이 터미널이 자동으로 인증을 끝마칩니다...\n");

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/oauth2callback")) return;

  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");

  res.end("인증 완료! 이 탭은 닫으셔도 됩니다.");
  server.close();

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "\nrefresh_token을 못 받았습니다. Google 계정 설정에서 이 앱 권한을 제거한 뒤(myaccount.google.com/permissions) 다시 시도해주세요.\n"
    );
    process.exit(1);
  }

  console.log("\n=== 아래 값을 .env의 YOUTUBE_REFRESH_TOKEN 에 저장하세요 ===");
  console.log(tokens.refresh_token);
  console.log("=======================================================\n");
  process.exit(0);
});

server.listen(PORT);
