const { XMLParser } = require("fast-xml-parser");

const xmlParser = new XMLParser({ ignoreAttributes: false });

function trendsRssUrl(geo) {
  return `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
}

// style: "myriad" — 10000 단위로 묶는 표기(한국/일본/중국권, 만·千). "thousand" — 1000 단위(K/M, 영미권/독일권).
function formatVolume(volume, numberFormat = {}) {
  const style = numberFormat.style || "myriad";
  const units = numberFormat.units || {};
  if (style === "thousand") {
    if (volume >= 1000000) return `${Math.round(volume / 1000000)}${units.million || "M"}+`;
    if (volume >= 1000) return `${Math.round(volume / 1000)}${units.thousand || "K"}+`;
    return `${volume}+`;
  }
  if (volume >= 10000) return `${Math.round(volume / 10000)}${units.man || "만"}+`;
  if (volume >= 1000) return `${Math.round(volume / 1000)}${units.cheon || "천"}+`;
  return `${volume}+`;
}

async function fetchRawTrends(geo = "KR", numberFormat) {
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
      traffic: volumeNum ? formatVolume(volumeNum, numberFormat) : trafficRaw,
      startedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null,
      newsUrls,
      category: null,
      summary: null,
    };
  });
}

module.exports = { fetchRawTrends, formatVolume, trendsRssUrl };
