# E2E (고객 플로우 QA 자동화) — w1 / task #28

Playwright 기반 고객 핵심 구매 플로우 자동화. **목표: go-live 전 고객 플로우 회귀 방지.**

## 상태
- ✅ 스캐폴딩 + 스펙 skeleton (DB 불필요 코드작업 — 완료)
- ⏳ 실행은 **로컬 docker(postgres) 복구 후** 가능 (이 PC 컨테이너 엔진 미설치 블로커)

## 실행 (docker 복구 후)
```bash
npm run e2e:install      # 1회: chromium 브라우저 다운로드
bash scripts/dev-up.sh   # DB + seed (테스트 계정 생성)
npm run test:e2e         # webServer가 npm run dev 자동 기동/재사용
npm run test:e2e:ui      # 디버그(UI 모드)
```

## 구성
| 파일 | 용도 |
|---|---|
| `../playwright.config.ts` | baseURL :3001, webServer(dev 자동기동), chromium |
| `customer-flow.spec.ts` | 탐색→상세→가입/로그인→장바구니→픽업예약 |
| `fixtures/test-accounts.ts` | seed 기준 테스트 계정 (master/데모고객) |

## 주의
- 스펙의 `[TODO:selector]` / `[TODO:assert]` 지점은 앱 첫 실행 시 실제 DOM으로 검증·교정 필요(현재 role/label 추정).
- 고객 포털만 대상(admin/staff/store 포털은 별도 스펙으로 확장 예정).
- 신규가입 테스트는 `uniquePhone()`으로 휴대전화 충돌 회피.
