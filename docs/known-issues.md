# Known Issues (추적용)

## 🔴 P1 — FIFO 스키마가 prod·로컬·마이그레이션 어디에도 없음 (2026-06-01 발견)

### 증상
- 코드(`src/db/schema/inventory.ts`, `orders.ts`)는 FIFO 재고/원가 기능을 정의(2026-05-22 도입):
  - 테이블: `inbound_shipments`, `inventory_lots`
  - 컬럼: `inventory_movements.lot_id` + `unit_cost_snapshot`, `order_items.lot_id`
- 그러나 **prod Neon 에 위 테이블/컬럼이 존재하지 않음** (적용 마이그레이션 0000~0025, FIFO 이전 상태).
- 마이그레이션 SQL/스냅샷에도 FIFO 변경분이 없음 → `db:generate` 가 누락된 채 코드만 앞서감.

### 영향 (prod 에서 실행 시 런타임 에러 가능)
| 코드 | 기능 |
|---|---|
| `api/warehouse/inbound` | 입고 등록 (`inventory_lots` INSERT) |
| `api/warehouse/inventory`, `inbound/history` | 재고/입고 이력 조회 |
| `lib/orders/transitions.ts:152` `consumeLotsForVariant` | 주문 완료/출고 시 로트 차감 |

→ 창고(warehouse) 모듈 + 로트 소진 주문전이가 prod 에서 동작 불가. (해당 기능 미사용 중이면 잠복)

### 2차 원인 — 마이그레이션 메타 손상
- `drizzle/meta` 스냅샷 **0013~0025 가 모두 동일 id `dd018b45`** (0013 상태로 복제, 갱신 안 됨).
- 그래서 `drizzle-kit generate` 가 collision 으로 실패 → 정상 마이그레이션 생성 불가.
- `migrate` 는 .sql 순차 실행이라 동작은 함(그래서 0025까지 적용됨).

### 임시 조치 (현재)
- **로컬 개발**: `drizzle-kit push`(TS 스키마 직접 반영)로 우회 → `scripts/dev-up.sh` 가 사용. 로컬은 FIFO 포함 완전 스키마로 동작.
- **prod 미변경**: prod DDL 은 리스크가 있어 손대지 않음.

### 정식 해결 (TODO, 별도 세션 — prod 영향이라 신중히)
1. `drizzle/meta` 스냅샷 체인 복구(0014~0025 각 상태 재생성) 또는 메타 리셋(`drizzle-kit generate --custom` / baseline 재작성).
2. FIFO 마이그레이션 0026 작성: `CREATE TABLE inbound_shipments, inventory_lots` + `ALTER inventory_movements/order_items ADD lot_id, unit_cost_snapshot` + 인덱스/FK.
3. 로컬 검증 → prod 적용(가산적 DDL, 데이터 손실 위험 낮음) → Vercel 빌드의 `drizzle-kit migrate` 정상화.
