# Funnyview Pickup — Claude 세션 진입점

> 이 파일은 **새 Claude Code 세션이 처음 읽어야 할 단일 진입점** 입니다.
> 모든 확정 사항의 상세는 `docs/spec.json` 을 참조.

## 한 줄 요약

**(주)퍼니뷰의 한국 콘택트렌즈 픽업 플랫폼** — Next.js 14 + Drizzle + Neon + Vercel + 카카오 로컬 API. 4 portal (customer/admin/staff/store) hostname 분리.

## 작업 시작 전 필수 읽기

| 파일 | 용도 |
|---|---|
| `docs/spec.json` | **모든 확정 사항 단일 진실의 출처** — 새 작업 전 반드시 검토 |
| `docs/spec.html` | 사람용 시각화 보고서 (브라우저로 열기) |
| `CLAUDE.md` (이 파일) | 새 세션 진입점 |
| `README.md` | 운영자/개발자 셋업 가이드 |
| `.env.example` | 환경변수 템플릿 |

## 절대 원칙

1. **frame-ops 와 완전 무관** — 이 repo (jiny8366/funnyview-pickup) 단독. 매개 push 금지.
2. **확정 사항 변경 불가** — `docs/spec.json` 변경은 사용자 명시 동의 후. 임의 변경 ❌
3. **분리된 portal 4개** — customer / admin / staff / store. 코드 작성 시 portal 별 영향 명확히
4. **Light 모드 고정** — 다크모드 대응 안 함 (input 가독성 보장)
5. **PAT 사용 push** — sandbox 가 funnyview-pickup repo 에 직접 push (frame-ops 매개 X)
6. **재고 원가 = 도수별 FIFO** — 콘택트렌즈는 같은 제품도 도수(SPH/CYL)마다 SKU 가 다르고 입고 수량·단가가 도수별로 다름. 입고는 `inbound_shipments`(1제품×1입고일 헤더) + `inventory_lots`(도수별 행) 로 기록하고, 출고는 `lens_variant` 단위로 가장 오래된 로트부터 차감(FIFO). 출고 라인(`order_items.unitCost`)에는 FIFO 단가가 기록되어 수익률 정산의 근거가 됨. 표준매입가(standardCost)는 참고용이지 원가 계산에 쓰면 안 됨. 상세는 `docs/spec.json` 의 `inventoryFifo`.

## 재고/원가 핵심 정책 (FIFO)

> 입고가가 시점마다 달라지는 환경에서 정확한 수익률을 내려면 출고 단가는 반드시 실제 입고 로트의 단가여야 함.

| 항목 | 규칙 |
|---|---|
| FIFO 단위 | `lens_variants.id` (= 제품 × 도수 조합). 도수가 다르면 독립 로트 |
| 입고 단위 | `inbound_shipments` 1건 = 1제품 × 1입고일 × N도수. 도수별 수량을 한 화면에서 입력 |
| 출고 차감 | `inboundDate ASC` 정렬로 가장 오래된 `inventory_lots` 부터 `quantityRemaining` 차감 |
| 출고 단가 | `order_items.unitCost` = 소진된 로트(들)의 가중평균 단가 |
| 수익률 | `(lineTotal − unitCost × qty) / lineTotal`. **절대 `standardCost` 로 계산 금지** |
| 반품 | 새 입고 전표로 재등록 (원 로트 복원 X) |

관련 마이그레이션: `0014 — inbound_shipments + inventory_lots + lot_id 컬럼 추가`

## 통합 테스트 계정 (모든 portal 진입)

```
ID:  jiny8366
PW:  2282
```

→ admin role 이라 customer/admin/staff/store 모두 로그인 가능. 다른 시드 계정은 `docs/spec.json` 의 `auth.testAccounts.seeded` 참조.

## 접속 URL (4 portal)

| 역할 | URL |
|---|---|
| 고객 (메인) | https://funnyview-pickup.vercel.app |
| 관리자 | https://admin-funnyview-pickup.vercel.app |
| 픽업서비스 운영 | https://staff-funnyview-pickup.vercel.app |
| 픽업가맹점 | https://store-funnyview-pickup.vercel.app |

## 핵심 기술 스택

- **Frontend**: Next.js 14 (App Router) + TypeScript strict + Tailwind
- **DB**: PostgreSQL (Neon Singapore Pooled) + Drizzle ORM
- **Cache**: Redis (Upstash, 선택)
- **Auth**: jose (JWT), 4-role + hostname-based portal middleware
- **Geo**: 카카오 로컬 API (`KAKAO_REST_API_KEY`)
- **Deploy**: Vercel (`main` 자동 배포, `drizzle-kit migrate` build-time)

## 작업 디렉토리

```
/home/user/funnyview-pickup    (sandbox)
~/funnyview-pickup             (사용자 PC)
```

**다음 세션은 ~/funnyview-pickup 에서 시작** → sandbox UI 가 frame-ops 표시 영구 종료.

## 다중 환경 공유 기억 규약 (M1 · M3 · claude.ai/code 웹)

> **단일 기억공간 = GitHub 레포(jiny8366/funnyview-pickup).** 세 환경 모두 같은 레포를 본다.
> 공유되는 기억: 코드 + `CLAUDE.md`(이 파일) + `docs/spec.json`(확정 사양 SoT).
> **공유 안 되는 것**: `.env.local`(시크릿, gitignore), `~/.claude` 개인 메모리 — 머신별 로컬.

| 환경 | 접근 |
|---|---|
| M1 / M3 (로컬) | `~/funnyview-pickup`, VS Code + Claude Code |
| claude.ai/code (웹) | 같은 GitHub 레포에 연결된 클라우드 세션, 브라우저 어디서나 |

**동기화 의식 (반드시)**
```bash
git pull --ff-only origin main   # 작업 시작 전 — 항상 최신 기억 받기
git push origin main             # 작업 끝 — 즉시 공유 (다른 환경이 보게)
```
- 한 환경에서 push 안 하면 다른 환경은 그 작업을 모른다. **작업 끝나면 즉시 push.**

### 새 머신(M3 등) 온보딩 — 한 방 셋업
```bash
git clone https://github.com/jiny8366/funnyview-pickup.git && cd funnyview-pickup
# ① .env.local 을 M1 에서 안전하게 복사 (AirDrop 권장) — git 으로 안 옴(시크릿)
# ② 컨테이너 엔진 (없으면): brew install colima docker docker-compose
bash scripts/dev-up.sh        # 엔진 기동 → DB/Redis → drizzle-kit push → seed
npm run dev                   # http://localhost:3001
```

### 동기화 검증 (핸드셰이크)
```bash
bash scripts/sync-check.sh    # M1·M3 에서 각각 실행 → 출력 대조
```
HEAD · behind/ahead(0/0) · postgres=healthy · seed-counts · env-keys 가 같으면 동일 컨디션.

### ⚠️ 공유되는 것 / 안 되는 것 (오해 주의)
- **git 으로 공유**: 코드, 스키마(`src/db/schema`), 시드 스크립트, 마이그레이션, 문서.
- **공유 안 됨 (머신별 로컬)**: 각 PC 의 **로컬 Postgres 컨테이너 안 데이터**. M1 에서 만든 주문/재고는 M3 에 안 나타난다. "동일 컨디션"=같은 코드+같은 스키마+같은 시드 기준선이지, 실시간 데이터 공유가 아님.
- 실시간 데이터까지 공유하려면 양쪽 `.env.local` 의 `DATABASE_URL` 을 **공용 원격 DB(예: Neon dev 브랜치)** 로 맞춰야 함.
- `.env.local`(시크릿) · `~/.claude` 개인 메모리도 머신별 로컬.

### 스키마 적용 주의 (현재 마이그레이션 메타 손상)
- `drizzle/meta` 스냅샷이 0013 에서 고장 → `db:generate` 불가, **로컬은 `drizzle-kit push` 사용**(dev-up.sh 가 처리).
- prod FIFO 스키마 누락 + 메타 복구는 별도 트래킹 (`docs/known-issues.md`).

## 빠른 명령 reference

```bash
# 개발
npm run dev

# 타입 체크 / 빌드
npx tsc --noEmit
npm run build

# DB
npm run db:generate          # 스키마 변경 → 마이그레이션 SQL
npm run db:migrate           # 마이그레이션 적용
npm run db:seed              # 시드 (idempotent)
npm run db:import-jinys      # 지니스안경 매장 import (~/jinys-pages 필요)

# 배포
git push origin main         # → Vercel 자동 빌드 (2-4분)
```

## 새 세션 시작 시 체크리스트

1. [ ] `docs/spec.json` 읽고 모든 확정 사항 파악
2. [ ] 사용자에게 "어느 부분 작업" 인지 명확히 받기
3. [ ] 작업 영향 portal 식별 (customer / admin / staff / store)
4. [ ] DB 스키마 변경 필요시 → 마이그레이션 0008+ 추가
5. [ ] 재고/원가 관련 작업이면 → 도수별 FIFO 원칙(`inventoryFifo`) 준수 확인
6. [ ] 코드 변경 후 `npx tsc --noEmit` 통과 확인
7. [ ] commit + push (사용자 명시적 요청 후)
8. [ ] Vercel 빌드 결과 사용자에게 확인 요청

## 빌드 실패 자주 발생하는 원인

- ESLint `react/no-unescaped-entities` — JSX 텍스트의 작은따옴표 → `{"..."}` 로 감싸기
- 타입 에러 — `npx tsc --noEmit` 로 사전 검증
- 마이그레이션 충돌 — 새 컬럼 이름 중복

## 운영 후 추가 작업 (TODO)

`docs/spec.json` 의 `todos` 섹션 참조. 우선순위 high/medium/low 로 분류.

---

**작업 시작 전 사용자에게 항상 확인**:
- 이 세션에서 무엇을 진행할지
- 변경 범위 (어느 파일/portal)
- 새 환경변수 필요 여부
- DB 마이그레이션 필요 여부

질문 없이 임의 변경 ❌
