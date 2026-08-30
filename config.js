// quiet: true — 그렇지 않으면 dotenv가 stdout에 안내 문구를 찍는데,
// 이게 scripts/build-prompt.js의 출력 리다이렉트에 섞여 AI 프롬프트를 오염시킨 적이 있다.
require("dotenv").config({ quiet: true });

const COUNTRY = (process.env.COUNTRY || "KR").toUpperCase();

const COUNTRIES = {
  KR: {
    code: "KR",
    lang: "ko",
    trendsGeo: "KR",
    newsHl: "ko",
    newsGl: "KR",
    newsCeid: "KR:ko",
    promptLanguage: "한국어",
    categories: ["IT/과학", "경제", "스포츠", "엔터", "사회/환경"],
    noArticleText: "관련 기사를 찾을 수 없어요",
    numberUnits: { man: "만", cheon: "천" },
    ui: {
      pageTitle: "NOW in Korea · 실시간 인기 검색어",
      logoSuffix: "in Korea",
      heading2: "가장 인기 있는 키워드를 모아봤어요",
      searchPlaceholder: "궁금한 키워드를 검색해보세요 (Enter로 구글 검색)",
      updatedPrefix: "KST",
      updatedSuffix: "업데이트",
      countdownSuffix: "뒤에 다시 확인해요",
      footer: "Google Trends(대한민국) 공식 RSS 피드(Daily Search Trends) 기반 · 네이버 실검이 아니며 구글과 제휴 관계가 없습니다",
      newBadge: "NEW",
      aiTag: "AI 요약",
      loadErrorPrefix: "데이터를 불러오지 못했습니다",
      timeZone: "Asia/Seoul",
      locale: "ko-KR",
    },
  },
  JP: {
    code: "JP",
    lang: "ja",
    trendsGeo: "JP",
    newsHl: "ja",
    newsGl: "JP",
    newsCeid: "JP:ja",
    promptLanguage: "日本語",
    categories: ["IT・科学", "経済", "スポーツ", "エンタメ", "社会・環境"],
    noArticleText: "関連記事が見つかりません",
    numberUnits: { man: "万", cheon: "千" },
    ui: {
      pageTitle: "NOW in Japan · リアルタイム急上昇ワード",
      logoSuffix: "in Japan",
      heading2: "人気のキーワードを集めました",
      searchPlaceholder: "気になるキーワードを検索 (Enterでgoogle検索)",
      updatedPrefix: "JST",
      updatedSuffix: "更新",
      countdownSuffix: "後に更新されます",
      footer: "Google Trends（日本）公式RSSフィード（Daily Search Trends）基準 · Googleとの提携関係はありません",
      newBadge: "NEW",
      aiTag: "AI要約",
      loadErrorPrefix: "データを読み込めませんでした",
      timeZone: "Asia/Tokyo",
      locale: "ja-JP",
    },
  },
};

const CURRENT = COUNTRIES[COUNTRY] || COUNTRIES.KR;

module.exports = { COUNTRY, COUNTRIES, CURRENT };
