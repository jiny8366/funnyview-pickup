#!/usr/bin/env bash
# Funnyview Pickup — 머신 간 동기화 지문(fingerprint) 출력
# M1 과 M3 에서 각각 실행해 출력이 일치하는지 대조 (host/시간 제외).
set -uo pipefail
cd "$(dirname "$0")/.."

echo "===== Funnyview Pickup sync-check ====="
echo "host         : $(hostname)"
git fetch -q origin 2>/dev/null || true
echo "branch       : $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
echo "HEAD         : $(git rev-parse --short HEAD 2>/dev/null)"
echo "origin/main  : $(git rev-parse --short origin/main 2>/dev/null)"
ba=$(git rev-list --left-right --count origin/main...HEAD 2>/dev/null || echo "?")
echo "behind/ahead : ${ba}"
echo "uncommitted  : $(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')개"
echo "node         : $(node -v 2>/dev/null)"
echo "docker       : $(docker info >/dev/null 2>&1 && echo running || echo 'n/a(엔진미기동)')"
pg=$(docker inspect --format '{{.State.Health.Status}}' funnyview-postgres 2>/dev/null || echo down)
rd=$(docker inspect --format '{{.State.Health.Status}}' funnyview-redis 2>/dev/null || echo down)
echo "postgres     : $pg"
echo "redis        : $rd"
if [ "$pg" = "healthy" ]; then
  fp=$(docker exec funnyview-postgres psql -U postgres -d funnyview_pickup -tAc \
    "select 'users='||(select count(*) from users)||' lenses='||(select count(*) from lenses)||' variants='||(select count(*) from lens_variants)||' stores='||(select count(*) from stores)||' home_sections='||(select count(*) from home_sections);" 2>/dev/null)
  echo "seed-counts  : ${fp:-N/A}"
fi
echo "env-keys     : $(grep -cE '^[A-Z_]+=' .env.local 2>/dev/null || echo 0)개 (.env.local)"
echo "======================================="
echo "→ M1·M3 비교 포인트: HEAD, behind/ahead(0/0), postgres=healthy, seed-counts, env-keys 가 같으면 동일 컨디션."
