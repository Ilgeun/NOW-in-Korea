const fs = require("fs");
const path = require("path");
const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition } = require("@remotion/renderer");

const PROPS_PATH = path.join(__dirname, "..", "props.json");
const OUT_DIR = path.join(__dirname, "..", "out");
const ENTRY_POINT = path.join(__dirname, "index.js");

function safeFileName(keyword) {
  return keyword.replace(/[^\w가-힣]+/g, "-").replace(/^-+|-+$/g, "");
}

(async () => {
  const { trends } = JSON.parse(fs.readFileSync(PROPS_PATH, "utf-8"));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`[render-all] 번들링 중...`);
  const bundleLocation = await bundle({ entryPoint: ENTRY_POINT });

  for (const trend of trends) {
    const inputProps = { trend };
    const composition = await selectComposition({ serveUrl: bundleLocation, id: "TrendShort", inputProps });
    const outputLocation = path.join(OUT_DIR, `${trend.rank}-${safeFileName(trend.keyword)}.mp4`);

    console.log(`[render-all] (${trend.rank}위) ${trend.keyword} 렌더링 중...`);
    await renderMedia({ composition, serveUrl: bundleLocation, codec: "h264", outputLocation, inputProps });
    console.log(`[render-all] 완료: ${outputLocation}`);
  }
})().catch((err) => {
  console.error("[render-all] 실패:", err);
  process.exit(1);
});
