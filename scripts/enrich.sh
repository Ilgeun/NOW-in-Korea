#!/bin/bash
set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_BIN="$HOME/.local/bin/claude"
NODE_BIN="/usr/local/bin/node"

cd "$PROJECT_DIR"
mkdir -p data

echo "=== $(date '+%Y-%m-%d %H:%M:%S') enrich.sh 시작 ===" >> data/enrich.log

# 1. 구글 트렌드 RSS를 지금 시점 기준으로 새로 가져와 pending.json 갱신 (결정적 파싱, LLM 아님)
if [ ! -x "$NODE_BIN" ]; then
  echo "node를 찾을 수 없습니다: $NODE_BIN" >> data/enrich.log
  exit 1
fi
if ! "$NODE_BIN" scripts/fetch-trends.js >> data/enrich.log 2>&1; then
  echo "fetch-trends.js 실패, 중단" >> data/enrich.log
  exit 1
fi

# 2. 방금 새로 받아온 pending.json의 키워드 전부를 처음부터 다시 AI로 요약 (이전에 요약됐던 키워드도 예외 없이 재처리)
# 기사 본문은 위 fetch-trends.js가 이미 가져와서 pending.json에 넣어뒀으므로, 여기선 WebFetch가 필요 없다
# (Claude의 WebFetch가 일부 언론사에서 종종 실패하던 문제를 원천적으로 없앰).
if [ ! -x "$CLAUDE_BIN" ]; then
  echo "claude CLI를 찾을 수 없습니다: $CLAUDE_BIN" >> data/enrich.log
  exit 1
fi

# config.js의 COUNTRY 설정에 맞춰 프롬프트를 그때그때 생성한다 (언어/카테고리 등이 나라별로 다름)
# build-prompt.js가 data/prompt.generated.txt에 직접 쓰므로, stdout 리다이렉트에 의존하지 않는다
# (다른 모듈이 stdout에 안내 문구를 찍으면 프롬프트가 오염될 수 있어서 이 방식은 피한다).
if ! "$NODE_BIN" scripts/build-prompt.js >> data/enrich.log 2>&1; then
  echo "build-prompt.js 실패, 중단" >> data/enrich.log
  exit 1
fi
PROMPT="$(cat data/prompt.generated.txt)"

"$CLAUDE_BIN" -p "$PROMPT" \
  --restricted \
  --tools Write,Read \
  --allowedTools Write,Read \
  --permission-mode dontAsk \
  --max-budget-usd 2.00 \
  --output-format text \
  >> data/enrich.log 2>&1

echo "=== $(date '+%Y-%m-%d %H:%M:%S') enrich.sh 종료 (exit $?) ===" >> data/enrich.log
