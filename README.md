# NOW in Korea

Google Trends 공식 RSS(Daily Search Trends)를 기반으로 실시간 인기 검색어를 모아 보여주는 웹앱입니다. 각 키워드에 관련 뉴스 링크와 AI 요약을 함께 붙여줍니다. 한국(KR)/일본(JP) 두 지역을 지원합니다.

> 네이버 실검이 아니며, 구글과 제휴 관계가 없습니다.

## 주요 기능

- Google Trends RSS에서 실시간 인기 검색어 Top 10 수집
- 키워드별 관련 뉴스 기사 링크 및 본문 첨부
- Claude CLI를 이용한 키워드 AI 요약/카테고리 태깅
- 1시간 주기로 자동 갱신 (백그라운드 스케줄러)
- 데이터가 오래됐을 경우 방문 시점에 자동 복구(self-heal) 트리거

## 동작 구조

수집·요약 작업과 서빙을 분리한 구조입니다.

```
scripts/enrich.sh (launchd, 1시간마다)
  1. scripts/fetch-trends.js  → Google Trends RSS 수집 → data/pending.json
  2. scripts/build-prompt.js  → 국가별 프롬프트 생성   → data/prompt.generated.txt
  3. claude CLI                → 키워드 요약/카테고리   → data/enrichment.json

server.js
  → data/pending.json + data/enrichment.json를 읽어서 서빙만 함
  → 요청마다 디스크를 다시 읽지 않도록 30초간 메모리 캐시
  → pending.json이 2시간 이상 오래되면 방문 시점에 enrich.sh를 백그라운드로 재실행
```

## 시작하기

### 설치

```bash
npm install
```

### 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일에서 국가를 설정합니다.

| 변수 | 설명 | 값 |
|---|---|---|
| `COUNTRY` | 서비스 지역 | `KR` 또는 `JP` |

### 실행

```bash
npm start
```

기본적으로 `http://localhost:3000`에서 확인할 수 있습니다.

> 최초 실행 시 `data/pending.json`이 없으면 서버가 직접 한 번 수집합니다. 이후 주기적인 자동 갱신은 `scripts/enrich.sh`를 launchd(또는 cron)에 등록해서 사용합니다.

## 기술 스택

- [Express](https://expressjs.com/) — 웹 서버
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) — Google Trends RSS 파싱
- [dotenv](https://github.com/motdotla/dotenv) — 환경변수 관리
- [Claude CLI](https://docs.claude.com/en/docs/claude-code) — 키워드 요약/카테고리 생성

## 프로젝트 구조

```
server.js              # 요청 처리, 캐시, self-heal 트리거
config.js              # 국가별 설정(KR/JP)
lib/
  trends-fetcher.js     # Google Trends RSS 수집·파싱
  article-fetcher.js    # 뉴스 기사 본문 스크래핑
  news-search.js         # 로컬 뉴스 검색
scripts/
  fetch-trends.js        # pending.json 갱신
  build-prompt.js         # AI 요약용 프롬프트 생성
  enrich.sh                # 전체 파이프라인 실행 (launchd)
views/index.html         # 메인 페이지 템플릿
public/                  # 정적 리소스 (JS/CSS)
```
