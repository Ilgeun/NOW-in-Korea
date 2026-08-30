const POLL_MS = 5 * 60 * 1000;

const APP_CONFIG = window.APP_CONFIG || {
  timeZone: "Asia/Seoul",
  locale: "ko-KR",
  newBadge: "NEW",
  aiTag: "AI 요약",
  loadErrorPrefix: "데이터를 불러오지 못했습니다",
};

const listEl = document.getElementById("trend-list");
const errorEl = document.getElementById("error");
const searchEl = document.getElementById("search");
const countdownEl = document.getElementById("countdown");
const lastUpdatedEl = document.getElementById("last-updated");

let latestData = null;
let countdownTimer = null;

function renderSkeleton() {
  listEl.hidden = false;
  listEl.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const li = document.createElement("li");
    li.className = "skeleton";
    listEl.appendChild(li);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

function formatLocalTime(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleTimeString(APP_CONFIG.locale, {
    timeZone: APP_CONFIG.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function startBadgeHtml(startedAt) {
  if (!startedAt) return "";
  const isNew = Date.now() - new Date(startedAt).getTime() < ONE_HOUR_MS;
  if (isNew) return `<span class="badge new">${escapeHtml(APP_CONFIG.newBadge)}</span>`;
  return `<span class="badge-plain">${formatLocalTime(startedAt)}</span>`;
}

function normalizeSummary(summary) {
  if (!Array.isArray(summary)) {
    if (typeof summary === "string" && summary) return [{ text: summary, source: null, url: null }];
    return [];
  }
  return summary
    .map((item) => {
      if (typeof item === "string") return { text: item, source: null, url: null };
      if (item && typeof item === "object" && item.text) {
        return { text: item.text, source: item.source || null, url: item.url || null };
      }
      return null;
    })
    .filter(Boolean);
}

function summaryBulletHtml(bullet) {
  const suffix = bullet.source ? ` - ${bullet.source}` : "";
  const content = `${escapeHtml(bullet.text)}${escapeHtml(suffix)}`;
  if (bullet.url) {
    return `<a class="summary-link" href="${escapeHtml(bullet.url)}" target="_blank" rel="noopener noreferrer">${content}</a>`;
  }
  return content;
}

function itemHtml(t) {
  const bullets = normalizeSummary(t.summary);
  const hasDetail = bullets.length > 0;
  const hasTopic = Boolean(t.topic) && t.topic !== t.keyword;
  const title = hasTopic ? t.topic : t.keyword;
  const tags = Array.isArray(t.tags) ? t.tags.filter(Boolean) : [];
  return `
    <li class="trend-item" data-keyword="${escapeHtml(t.keyword)}">
      <div class="trend-row">
        <span class="rank">${t.rank}</span>
        <div class="main-col">
          <p class="keyword">${escapeHtml(title)}</p>
          <div class="meta-row">
            <div class="tag-row">
              ${tags.map((tag) => `<span class="hashtag">#${escapeHtml(tag)}</span>`).join("")}
            </div>
            <div class="badge-row">
              ${startBadgeHtml(t.startedAt)}
              ${t.category ? `<span class="category-badge">${escapeHtml(t.category)}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="score-col">
          ${hasDetail ? `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>` : ""}
        </div>
      </div>
      ${
        hasDetail
          ? `<div class="detail">
              <div class="detail-inner">
                <span class="ai-tag">${escapeHtml(APP_CONFIG.aiTag)}</span>
                <ul class="ai-summary-list">
                  ${bullets.map((b) => `<li>${summaryBulletHtml(b)}</li>`).join("")}
                </ul>
              </div>
            </div>`
          : ""
      }
    </li>
  `;
}

function attachRowHandlers() {
  listEl.querySelectorAll(".trend-item").forEach((item) => {
    if (!item.querySelector(".detail")) return;
    const row = item.querySelector(".trend-row");
    row.addEventListener("click", () => {
      item.classList.toggle("expanded");
    });
  });
}

function renderList(trends) {
  listEl.hidden = false;
  errorEl.hidden = true;
  listEl.innerHTML = trends.map(itemHtml).join("");
  attachRowHandlers();
}

function render() {
  if (!latestData) {
    renderSkeleton();
    return;
  }
  renderList(latestData.trends);
}

function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startCountdown(nextRefreshAt) {
  clearInterval(countdownTimer);
  const target = new Date(nextRefreshAt).getTime();
  const tick = () => {
    const remaining = Math.max(0, Math.round((target - Date.now()) / 1000));
    countdownEl.textContent = formatCountdown(remaining);
    if (remaining <= 0) clearInterval(countdownTimer);
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

async function loadTrends() {
  try {
    const res = await fetch("/api/trends");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    latestData = data;
    lastUpdatedEl.textContent = formatLocalTime(data.updatedAt);
    startCountdown(data.nextRefreshAt);
    render();
  } catch (err) {
    listEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = `${APP_CONFIG.loadErrorPrefix}: ${err.message}`;
  }
}

function searchOnGoogle() {
  const query = searchEl.value.trim();
  if (!query) return;
  const link = document.createElement("a");
  link.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

searchEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchOnGoogle();
});

renderSkeleton();
loadTrends();
setInterval(loadTrends, POLL_MS);
