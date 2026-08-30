const { XMLParser } = require("fast-xml-parser");

const xmlParser = new XMLParser({ ignoreAttributes: false });

function trendsRssUrl(geo) {
  return `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
}

function formatVolume(volume, units = { man: "만", cheon: "천" }) {
  if (volume >= 10000) return `${Math.round(volume / 10000)}${units.man}+`;
  if (volume >= 1000) return `${Math.round(volume / 1000)}${units.cheon}+`;
  return `${volume}+`;
}

async function fetchRawTrends(geo = "KR", numberUnits) {
  const res = await fetch(trendsRssUrl(geo), {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) {
    throw new Error(`Google Trends RSS request failed: ${res.status}`);
  }
  const xml = await res.text();
  const parsed = xmlParser.parse(xml);
  const items = parsed?.rss?.channel?.item;
  if (!items) {
    throw new Error("unexpected RSS shape");
  }
  const list = Array.isArray(items) ? items : [items];

  return list.slice(0, 10).map((item, i) => {
    const trafficRaw = item["ht:approx_traffic"] || null;
    const volumeNum = trafficRaw ? parseInt(String(trafficRaw).replace(/[^0-9]/g, ""), 10) : null;
    const newsItems = item["ht:news_item"]
      ? Array.isArray(item["ht:news_item"]) ? item["ht:news_item"] : [item["ht:news_item"]]
      : [];
    const newsUrls = newsItems
      .map((n) => ({ url: n["ht:news_item_url"], source: n["ht:news_item_source"] || null }))
      .filter((n) => Boolean(n.url))
      .slice(0, 2);

    return {
      rank: i + 1,
      keyword: item.title,
      traffic: volumeNum ? formatVolume(volumeNum, numberUnits) : trafficRaw,
      startedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      newsUrls,
      category: null,
      summary: null,
    };
  });
}

module.exports = { fetchRawTrends, formatVolume, trendsRssUrl };
