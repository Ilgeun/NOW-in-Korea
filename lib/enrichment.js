const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const { CURRENT } = require("../config");
const { fetchRawTrends } = require("./trends-fetcher");
const { attachArticleText } = require("./article-fetcher");
const { searchLocalNews } = require("./news-search");

const DATA_DIR = path.join(__dirname, "..", "data");
const PENDING_PATH = path.join(DATA_DIR, "pending.json");
const ENRICHMENT_PATH = path.join(DATA_DIR, "enrichment.json");
const TEMPLATE_PATH = path.join(__dirname, "..", "scripts", "enrich-prompt-api.template.txt");
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// launchd + claude CLI가 없는 클라우드 환경(예: Railway)을 위한, Gemini API 기반의 자체 완결형 갱신 파이프라인.
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

// responseMimeType을 application/json으로 지정하면 Gemini가 순수 JSON만 돌려준다
// (앞뒤 설명이나 마크다운 코드펜스가 섞이지 않는다).
async function summarizeWithGemini(items) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = buildPrompt(items);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  const parsed = JSON.parse(response.text);
  if (!Array.isArray(parsed.items)) throw new Error("Gemini 응답에 items 배열이 없습니다");
  return parsed.items;
}

async function runEnrichment() {
  const pending = await collectTrends();
  console.log(`[enrichment] (${CURRENT.code}) 트렌드 ${pending.items.length}개 수집 완료`);

  const items = await summarizeWithGemini(pending.items);
  const payload = { generatedAt: new Date().toISOString(), items };
  fs.writeFileSync(ENRICHMENT_PATH, JSON.stringify(payload, null, 2));
  console.log(`[enrichment] (${CURRENT.code}) AI 요약 ${items.length}개 완료`);
  return payload;
}

module.exports = { runEnrichment };
