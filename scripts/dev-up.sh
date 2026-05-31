#!/usr/bin/env bash
# Funnyview Pickup — 로컬 개발 환경 한 방 셋업 (M1 · M3 공통)
#
# 새 머신/M3 에서:
#   1) git clone 후 이 레포로 cd
#   2) .env.local 을 M1 에서 안전하게 복사 (AirDrop 등) — git 으로 안 옴 (시크릿)
#   3) brew install colima docker docker-compose   # 엔진 없으면
#   4) bash scripts/dev-up.sh
#
# 멱등(idempotent): 여러 번 돌려도 안전. 끝나면 npm run dev → http://localhost:3001
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ 1/6 .env.local 확인"
if [ ! -f .env.local ]; then
  echo "✗ .env.local 없음 — M1 에서 안전하게 복사해 오세요(AirDrop 등). 키 목록은 .env.example 참고."
  exit 1
fi

echo "▶ 2/6 컨테이너 엔진(colima) 확인/기동"
if ! command -v colima >/dev/null 2>&1; then
  echo "✗ colima 없음 — 설치: brew install colima docker docker-compose"
  exit 1
fi
colima status >/dev/null 2>&1 || colima start --cpu 2 --memory 4 --disk 60
docker context use colima >/dev/null 2>&1 || true

echo "▶ 3/6 의존성 설치 (npm install)"
npm install

echo "▶ 4/6 Postgres + Redis 기동 (docker compose)"
docker compose up -d
echo "   healthy 대기..."
for i in $(seq 1 40); do
  pg=$(docker inspect --format '{{.State.Health.Status}}' funnyview-postgres 2>/dev/null || echo none)
  [ "$pg" = "healthy" ] && { echo "   ✅ postgres healthy"; break; }
  sleep 2
done

echo "▶ 5/6 스키마 반영 (drizzle-kit push — TS 스키마 기준, 깨진 마이그레이션 메타 우회)"
# .env.local 안전 로드 (값 내 &,?,= 보존)
while IFS='=' read -r k v; do case "$k" in ''|\#*) continue;; esac; export "$k=$v"; done < .env.local
npx drizzle-kit push --force

echo "▶ 6/6 시드 (멱등)"
npm run db:seed

echo ""
echo "✅ 로컬 개발 환경 준비 완료 — 'npm run dev' 후 http://localhost:3001"
echo "   동기화 상태 확인: bash scripts/sync-check.sh"
