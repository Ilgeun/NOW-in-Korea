const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { CURRENT } = require("./config");
const { fetchRawTrends } = require("./lib/trends-fetcher");
const { attachArticleText } = require("./lib/article-fetcher");
const { searchLocalNews } = require("./lib/news-search");

const app = express();
const PORT = process.env.PORT || 3000;

// 실제 수집·요약은 scripts/enrich.sh(launchd, 1시간마다)가 전담한다.
// 서버는 그 결과 파일을 읽어서 서빙만 하며, 요청마다 디스크를 다시 읽지 않도록 짧게만 메모리 캐시한다.
const RESPONSE_CACHE_MS = 30 * 1000;
const CRON_INTERVAL_MS = 60 * 60 * 1000; // launchd 스케줄과 동일

// launchd가 잠자기 등으로 실행을 놓쳤을 때를 대비한 자체 복구 안전장치.
// pending.json이 이보다 오래되면, 실제 방문이 들어온 시점에 백그라운드로 한 번 갱신을 트리거한다(응답은 막지 않음).
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2시간
const ENRICH_RETRY_COOLDOWN_MS = 10 * 60 * 1000; // 트리거 후 10분간은 재시도하지 않음
let enrichTriggeredAt = 0;

function triggerBackgroundEnrichIfStale(pendingGeneratedMs, now) {
  if (now - pendingGeneratedMs < STALE_THRESHOLD_MS) return;
  if (now - enrichTriggeredAt < ENRICH_RETRY_COOLDOWN_MS) return;
  enrichTriggeredAt = now;

  console.warn("[self-heal] pending.json이 2시간 이상 오래돼서 백그라운드로 enrich.sh를 실행합니다.");
  const child = spawn("/bin/bash", [path.join(__dirname, "scripts", "enrich.sh")], {
    detached: true,
    stdio: "ignore",
  });
  child.on("error", (err) => console.error("[self-heal] enrich.sh 실행 실패:", err.message));
  child.unref();
}

const DATA_DIR = path.join(__dirname, "data");
const PENDING_PATH = path.join(DATA_DIR, "pending.json");
const ENRICHMENT_PATH = path.join(DATA_DIR, "enrichment.json");
const VIEW_PATH = path.join(__dirname, "views", "index.html");

let cache = { data: null, fetchedAt: 0 };

function readPendingTrends() {
  try {
    const raw = fs.readFileSync(PENDING_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) return null;
    // COUNTRY를 바꾼 직후라 예전 나라의 데이터가 남아있으면, 없는 것과 동일하게 취급해서
    // 즉시 새로 수집하도록 한다 (그렇지 않으면 서버 재시작만으로는 화면이 안 바뀜).
    if (parsed.country && parsed.country !== CURRENT.code) {
      console.warn(
        `[bootstrap] pending.json은 ${parsed.country} 데이터인데 현재 COUNTRY=${CURRENT.code} — 다시 수집합니다.`
      );
      return null;
    }
    return { generatedAt: parsed.generatedAt, items: parsed.items };
  } catch {
    return null;
  }
}

function writePendingFile(trends) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const payload = { generatedAt: new Date().toISOString(), country: CURRENT.code, items: trends };
    fs.writeFileSync(PENDING_PATH, JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error("[pending] failed to write pending.json:", err.message);
  }
}

function readLocalEnrichment() {
  try {
    const raw = fs.readFileSync(ENRICHMENT_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.items)) return null;
    return new Map(parsed.items.map((i) => [i.keyword, i]));
  } catch {
    return null;
  }
}

function applyLocalEnrichment(trends) {
  const byKeyword = readLocalEnrichment();
  if (!byKeyword) return trends;
  return trends.map((t) => {
    const match = byKeyword.get(t.keyword);
    return match
      ? {
          ...t,
          topic: match.topic || t.keyword,
          tags: Array.isArray(match.tags) ? match.tags : [],
          category: match.category,
          summary: match.summary,
        }
      : t;
  });
}

async function fetchTrends() {
  const now = Date.now();
  if (cache.data && now - cache.fetchedAt < RESPONSE_CACHE_MS) {
    return cache.data;
  }

  // 실제 수집은 scripts/enrich.sh(launchd, 1시간마다)가 pending.json을 갱신하는 방식으로 전담한다.
  // 여기서는 그 파일을 읽기만 하고, 파일이 아예 없을 때(최초 실행)만 1회 직접 가져온다.
  let pending = readPendingTrends();
  if (!pending) {
    console.warn("[bootstrap] pending.json이 없어 최초 1회 직접 수집합니다.");
    const rawTrends = await fetchRawTrends(CURRENT.trendsGeo, CURRENT.numberUnits);
    await attachArticleText(rawTrends);
    const newsParams = { hl: CURRENT.newsHl, gl: CURRENT.newsGl, ceid: CURRENT.newsCeid };
    await Promise.all(
      rawTrends.map(async (t) => {
        const local = await searchLocalNews(t.keyword, newsParams, 2);
        t.newsUrls = [...(t.newsUrls || []), ...local];
      })
    );
    writePendingFile(rawTrends);
    pending = { generatedAt: new Date().toISOString(), items: rawTrends };
  }

  const trends = applyLocalEnrichment(pending.items);

  // 구글 RSS 항목들의 pubDate 중 가장 최신 값 = 구글이 실제로 이 데이터를 갱신한 시각
  const updatedAt = trends.reduce(
    (latest, t) => (t.startedAt && (!latest || t.startedAt > latest) ? t.startedAt : latest),
    null
  );

  const pendingGeneratedMs = pending.generatedAt ? new Date(pending.generatedAt).getTime() : now;
  triggerBackgroundEnrichIfStale(pendingGeneratedMs, now);

  cache = {
    data: {
      updatedAt: updatedAt || new Date(now).toISOString(),
      nextRefreshAt: new Date(pendingGeneratedMs + CRON_INTERVAL_MS).toISOString(),
      trends,
    },
    fetchedAt: now,
  };
  return cache.data;
}

function escapeForHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderIndexHtml() {
  const template = fs.readFileSync(VIEW_PATH, "utf-8");
  const appConfig = {
    timeZone: CURRENT.ui.timeZone,
    locale: CURRENT.ui.locale,
    newBadge: CURRENT.ui.newBadge,
    aiTag: CURRENT.ui.aiTag,
    loadErrorPrefix: CURRENT.ui.loadErrorPrefix,
  };

  return template
    .split("{{LANG}}").join(CURRENT.lang)
    .split("{{PAGE_TITLE}}").join(escapeForHtml(CURRENT.ui.pageTitle))
    .split("{{LOGO_SUFFIX}}").join(escapeForHtml(CURRENT.ui.logoSuffix))
    .split("{{HEADING2}}").join(escapeForHtml(CURRENT.ui.heading2))
    .split("{{UPDATED_PREFIX}}").join(escapeForHtml(CURRENT.ui.updatedPrefix))
    .split("{{UPDATED_SUFFIX}}").join(escapeForHtml(CURRENT.ui.updatedSuffix))
    .split("{{COUNTDOWN_SUFFIX}}").join(escapeForHtml(CURRENT.ui.countdownSuffix))
    .split("{{SEARCH_PLACEHOLDER}}").join(escapeForHtml(CURRENT.ui.searchPlaceholder))
    .split("{{FOOTER}}").join(escapeForHtml(CURRENT.ui.footer))
    .split("{{APP_CONFIG_JSON}}").join(JSON.stringify(appConfig));
}

app.get("/", (req, res) => {
  try {
    res.type("html").send(renderIndexHtml());
  } catch (err) {
    res.status(500).send("Failed to render page: " + err.message);
  }
});

app.use(express.static("public"));

app.get("/api/trends", async (req, res) => {
  try {
    const data = await fetchTrends();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: "failed to fetch trends", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT} (country=${CURRENT.code})`);
  fetchTrends().catch((err) => console.error("[startup] initial trends load failed:", err.message));
});
