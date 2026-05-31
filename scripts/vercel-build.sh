#!/usr/bin/env bash
# Vercel 빌드 — Neon 데이터 전송 절감.
# 기본은 DB 단계(drizzle-kit migrate + import) 생략, next build 만 수행한다.
# 스키마 변경 등 DB 반영이 필요한 배포에서만 Vercel 환경변수 RUN_DB_MIGRATE=1 을 설정해 배포.
set -euo pipefail

if [ "${RUN_DB_MIGRATE:-0}" = "1" ]; then
  echo "▶ DB 단계 실행 (RUN_DB_MIGRATE=1): drizzle-kit migrate + import-jinys-on-build"
  drizzle-kit migrate
  tsx scripts/import-jinys-on-build.ts
else
  echo "▶ DB 단계 생략 (Neon 전송 절감). 스키마 반영이 필요하면 RUN_DB_MIGRATE=1 로 배포하세요."
fi

next build
