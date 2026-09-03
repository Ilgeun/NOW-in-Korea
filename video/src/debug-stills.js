const fs = require("fs");
const path = require("path");
const { bundle } = require("@remotion/bundler");
const { renderStill, selectComposition } = require("@remotion/renderer");

const PROPS_PATH = path.join(__dirname, "..", "props.json");
const OUT_DIR = path.join(__dirname, "..", "debug-stills");
const ENTRY_POINT = path.join(__dirname, "index.js");

(async () => {
  const { trends } = JSON.parse(fs.readFileSync(PROPS_PATH, "utf-8"));
  const trend = trends[0];
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const bundleLocation = await bundle({ entryPoint: ENTRY_POINT });
  const inputProps = { trend };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "TrendShort", inputProps });

  console.log("durationInFrames:", composition.durationInFrames);
  const frames = [5, 30, 60, 90, Math.floor(composition.durationInFrames / 2), composition.durationInFrames - 5];

  for (const frame of frames) {
    const outputLocation = path.join(OUT_DIR, `frame-${frame}.png`);
    await renderStill({ composition, serveUrl: bundleLocation, output: outputLocation, frame, inputProps });
    console.log(`frame ${frame} -> ${outputLocation}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
