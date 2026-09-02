const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { CURRENT } = require("../config");
const { fetchRawTrends } = require("./trends-fetcher");
const { attachArticleText } = require("./article-fetcher");
const { searchLocalNews } = require("./news-search");

const DATA_DIR = path.join(__dirname, "..", "data");
const PENDING_PATH = path.join(DATA_DIR, "pending.json");
const ENRICHMENT_PATH = path.join(DATA_DIR, "enrichment.json");
const TEMPLATE_PATH = path.join(__dirname, "..", "scripts", "enrich-prompt-api.template.txt");
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";

// launchd + claude CLI가 없는 클라우드 환경(예: Railway)을 위한, Claude API 기반의 자체 완결형 갱신 파이프라인.
// scripts/enrich.sh(로컬 launchd용)와 동일한 일을 하지만, 외부 프로세스 없이 서버 안에서 직접 끝낸다.

async function collectTrends() {
  const trends = await fetchRawTrends(CURRENT.trendsGeo, CURRENT.numberFormat);
  await attachArticleText(trends);

  const newsParams = { hl: CURRENT.newsHl, gl: CURRENT.newsGl, ceid: CURRENT.newsCeid };
  await Promise.all(
    trends.map(async (t) => {
      const local = await searchLocalNews(t.keyword, newsParams, 2);
      t.newsUrls = [...(t.newsUrls || []), ...local];
    })
  );

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload = { generatedAt: new Date().toISOString(), country: CURRENT.code, items: trends };
  fs.writeFileSync(PENDING_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

function buildPrompt(items) {
  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  const itemsForPrompt = items.map((t) => ({ keyword: t.keyword, newsUrls: t.newsUrls || [] }));
  return template
    .split("{{LANGUAGE}}").join(CURRENT.promptLanguage)
    .split("{{CATEGORIES}}").join(CURRENT.categories.join(", "))
    .split("{{NO_ARTICLE_TEXT}}").join(CURRENT.noArticleText)
    .split("{{ITEMS_JSON}}").join(JSON.stringify(itemsForPrompt, null, 2));
}

// Claude에게 "{" 로 답을 시작하도록 미리 채워두면(prefill), 앞뒤에 설명이나
// 코드펜스가 섞이는 일 없이 순수 JSON만 돌려받을 확률이 크게 올라간다.
async function summarizeWithClaude(items) {
  const anthropic = new Anthropic();
  const prompt = buildPrompt(items);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      { role: "user", content: prompt },
      { role: "assistant", content: "{" },
    ],
  });

  const text = "{" + response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.items)) throw new Error("Claude 응답에 items 배열이 없습니다");
  return parsed.items;
}

async function runEnrichment() {
  const pending = await collectTrends();
  console.log(`[enrichment] (${CURRENT.code}) 트렌드 ${pending.items.length}개 수집 완료`);

  const items = await summarizeWithClaude(pending.items);
  const payload = { generatedAt: new Date().toISOString(), items };
  fs.writeFileSync(ENRICHMENT_PATH, JSON.stringify(payload, null, 2));
  console.log(`[enrichment] (${CURRENT.code}) AI 요약 ${items.length}개 완료`);
  return payload;
}

module.exports = { runEnrichment };
