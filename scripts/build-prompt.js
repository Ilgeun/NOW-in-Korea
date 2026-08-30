const fs = require("fs");
const path = require("path");
const { CURRENT } = require("../config");

const TEMPLATE_PATH = path.join(__dirname, "enrich-prompt.template.txt");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "prompt.generated.txt");

const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");

const filled = template
  .split("{{LANGUAGE}}").join(CURRENT.promptLanguage)
  .split("{{CATEGORIES}}").join(CURRENT.categories.join(", "))
  .split("{{NO_ARTICLE_TEXT}}").join(CURRENT.noArticleText);

// stdout 리다이렉트(> file)에 의존하면 dotenv 등 다른 모듈이 stdout에 찍는 안내문이
// 프롬프트 파일에 섞여들 위험이 있으므로, 파일에 직접 쓴다.
fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, filled);
console.log(`[build-prompt] (${CURRENT.code}) 프롬프트 생성 완료: ${OUTPUT_PATH}`);
