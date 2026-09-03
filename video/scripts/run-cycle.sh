#!/bin/bash
# launchd가 6시간마다 이 스크립트를 실행한다. 그 시점의 실시간 1위 트렌드로
# 영상을 만들고 유튜브에 업로드까지 한 사이클로 처리한다.
set -e
cd "$(dirname "$0")/.."

echo "===== $(date '+%Y-%m-%d %H:%M:%S') 사이클 시작 ====="

node src/prepare-data.js
node src/generate-script.js
node src/generate-image.js
node src/generate-audio.js
node src/render-all.js
node src/upload-youtube.js

echo "===== $(date '+%Y-%m-%d %H:%M:%S') 사이클 완료 ====="
