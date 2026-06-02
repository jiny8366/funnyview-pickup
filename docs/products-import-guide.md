# 상품 정보 일괄 업데이트 가이드

> 관리자 포털 `/admin/products` → "CSV 내보내기" / "CSV 일괄 업로드" 로 이용.
> 실제 import 엔드포인트: `POST /api/admin/products/import` (`src/app/api/admin/products/import/route.ts`)
> 샘플 파일: [`docs/products-import-sample.csv`](./products-import-sample.csv)

## 1. 흐름

```
1) /admin/products 에서 "CSV 내보내기" 클릭
   → 현재 등록된 제품 전체가 CSV 로 다운로드 (BOM 포함, 엑셀 한글 OK)

2) 엑셀/스프레드시트로 편집
   → 변경할 행의 변경할 컬럼만 수정 (다른 컬럼은 그대로 두면 변경 안 됨)

3) "CSV 일괄 업로드" 로 다시 업로드
   → productCode 기준으로 기존 제품 찾아 매칭
   → 변경된 필드만 update
   → 가격 컬럼은 별도 이력(lens_price_entries)에도 기록 + 캐시 동기화
```

## 2. 매칭 규칙

| 항목 | 동작 |
|---|---|
| `productCode` | **필수 매칭 키**. 빈 값/없는 코드는 행 무시 또는 `errors` 에 보고 |
| 빈 셀 | **변경 안 함** (NULL 로 덮어쓰지 않음) |
| 신규 행 | import 는 신규 생성 ❌ — UI 의 "+ 제품 등록" 으로 추가 |
| 가격 컬럼 | 표준가가 바뀐 경우에만 `lens_price_entries` 에 새 이력 + 캐시 갱신 |

## 3. 컬럼 상세

### 3.1 식별 / 분류 (필수 키 + 기본 메타)

| 컬럼 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `productCode` | text (UNIQUE) | ✓ | 내부 제품 코드. 매칭 키. **수정 불가** — 변경하려면 신규 등록 후 구코드 비활성 | `ACU-MOIST-1D-30P` |
| `brand` | text | — | 브랜드 한글명. `brands` 테이블 nameKo 와 일치 권장 | `아큐브` |
| `name` | text | — | 제품 표시명 | `원데이 아큐브 모이스트 30매` |
| `lensType` | enum | — | `spherical` (일반) / `toric` (난시) / `multifocal` (다초점) / `color` (컬러) / `circle` (써클) | `spherical` |
| `replacementCycle` | enum | — | `1day` / `2week` / `1month` / `3month` / `6month` / `1year` | `1day` |
| `piecesPerBox` | integer | — | 한 박스당 매수 | `30` |
| `isActive` | boolean | — | 노출 여부. `TRUE/FALSE` (또는 `1/0`, `Y/N`, `예`) | `TRUE` |
| `isNew` | boolean | — | NEW 뱃지 표시 | `FALSE` |

### 3.2 렌즈 스펙

| 컬럼 | 타입 | 단위 | 설명 | 예시 |
|---|---|---|---|---|
| `baseCurve` | numeric(4,2) | mm | BC (베이스 커브) | `8.50` |
| `diameter` | numeric(4,2) | mm | DIA (직경) | `14.20` |
| `waterContent` | numeric(5,2) | % | 함수율 | `58.00` |
| `material` | text | — | 재질명 (자유 텍스트) | `etafilcon A` |
| `oxygenDkt` | integer | Dk/t | 산소투과율 — 장시간 착용 지표 | `33` |
| `uvProtection` | boolean | — | UV 차단 기능 | `TRUE` |
| `blueLight` | boolean | — | 블루라이트 차단 | `FALSE` |
| `sphereMin` | numeric(4,2) | D | 최소 SPH (음수) | `-12.00` |
| `sphereMax` | numeric(4,2) | D | 최대 SPH (양수) | `+6.00` |

> ⓘ 도수별 SKU 는 별도 `lens_variants` 테이블에서 관리. 본 CSV 는 lens 마스터(헤더) 정보만.

### 3.3 가격 (모두 부가세 포함, KRW)

콘택트렌즈 가격 모델은 **3단계** (매입 / 공급 / 소비자) + **호환용 단순 가격** 으로 구성.

#### 호환용 (구버전 호환 — 신규 화면은 standardCost / standardSupplyPrice / recommendedRetailPrice 사용)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `price` | integer | 단일 판매가 (호환). 신규 화면에선 `recommendedRetailPrice` 우선 |
| `cost` | integer | 단일 원가 (호환). 신규 화면에선 `standardCost` 우선 |

#### 매입 (제조사/수입원 → 본사)
| 컬럼 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `standardCost` | integer | 표준매입가 (부가세 포함) | `9000` |
| `purchaseDiscountAmount` | integer | 매입 할인 금액 (정액) | `500` |
| `purchaseDiscountPercent` | integer | 매입 할인 % (0–100) | `5` |

실효 매입가 = `standardCost − purchaseDiscountAmount − (standardCost × purchaseDiscountPercent / 100)`

#### 공급 (본사 → 가맹점)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `standardSupplyPrice` | integer | 표준공급가 (가맹점 도매가) |
| `supplyDiscountAmount` | integer | 공급 할인 금액 |
| `supplyDiscountPercent` | integer | 공급 할인 % |

#### 소비자 (가맹점 → 소비자)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `recommendedRetailPrice` | integer | 권장소비자가 (소매 표준) |

> ⚠ 가격 컬럼 변경 시 `lens_price_entries` 에 자동 이력 + Redis 캐시 invalidate.
> 적용 시작일을 지정하려면 CSV 가 아니라 admin UI의 "가격 정보" 탭에서 수동 등록 권장.

### 3.4 식약처 UDI (선택 — 영수증·세금계산서 표시용)

| 컬럼 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `manufacturer` | text | 제조원/수입원 | `Johnson & Johnson Vision` |
| `mfdsPermitNo` | text | 품목 허가번호 | `제조허가 21-1234` 또는 `수입허가 23-5678` |
| `mfdsClassificationCode` | text | 분류번호 (콘택트렌즈는 보통 `A07020`) | `A07020` |
| `mfdsProductName` | text | 식약처 등록 품목명 (법적 표시) | `원데이아큐브모이스트` |

### 3.5 카드/시리즈 표시 (선택 — 컬러렌즈 위주)

| 컬럼 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `colorName` | text | 컬러명 (카드에 표시) | `브라운` |
| `colorHex` | text | CSS 색상 HEX. 컬러 미리보기 점 색 | `#8B5A2B` |
| `seriesCode` | text | 같은 시리즈 묶음 키. 컬러 변형끼리 그룹 | `CHARM-1DAY-COLOR` |

> ⓘ 컬러렌즈는 같은 `seriesCode` 끼리 묶여 카탈로그 카드에 색상 변형(swatches) 으로 노출됨.

## 4. boolean 표기 허용 형식

import 의 `truthy` 함수가 받는 값 (대소문자 무관):
- `true`, `1`, `y`, `yes`, `예`, `o`, `on` → **TRUE**
- 그 외 (빈 값 포함) → **FALSE**

## 5. 흔한 실수

| 증상 | 원인 | 해결 |
|---|---|---|
| `<코드>: 제품을 찾을 수 없음` | `productCode` 가 DB 에 없음 | UI 에서 신규 등록 후 다시 export 받아 편집 |
| 가격 변경 안 됨 | 표준가 변경 없음 (할인 % 만 바뀜) | `standardCost`/`standardSupplyPrice`/`recommendedRetailPrice` 자체를 같이 바꿔야 새 이력 기록 |
| 한글 깨짐 | 엑셀이 BOM 없는 CSV 로 저장 | export 받은 파일 그대로 편집해서 저장하거나, 엑셀 "다른 이름으로 저장 → CSV UTF-8" 선택 |
| `isActive`/`uvProtection` 등 boolean 잘못 인식 | `TRUE/FALSE` 외 알 수 없는 값 | 위 [4. boolean 표기 허용 형식] 참고 |
| 빈 값을 의도적으로 NULL 로 만들고 싶음 | 현재 import 는 빈 값 = 무시 | UI 의 제품 편집 화면에서 직접 비우기 (CSV 로는 NULL 화 불가) |

## 6. 샘플 파일에 들어있는 4 행

[`products-import-sample.csv`](./products-import-sample.csv) 의 예시 행은 4가지 렌즈 유형을 모두 보여줍니다.

| productCode | lensType | replacementCycle | 특징 |
|---|---|---|---|
| `ACU-MOIST-1D-30P` | spherical | 1day | UV 차단 일반 원데이 |
| `ACU-OAS-TORIC-30P` | toric | 1day | 산소투과율 138 — 장시간 토릭 |
| `BSL-ULTRA-MULTI-6P` | multifocal | 1month | 다초점 1개월 |
| `CLR-CHARM-BROWN-10P` | color | 1day | colorHex/seriesCode 채워진 컬러 |

샘플 그대로 업로드하면 4 종 제품이 신규로 등록되지 **않습니다** (import 는 update-only). 먼저 admin UI 에서 동일 `productCode` 로 제품을 만들고, 그 다음 이 CSV 를 업로드해서 메타/가격을 채우는 흐름이 정석입니다.

## 7. 관련 코드 위치

| 파일 | 역할 |
|---|---|
| `src/app/api/admin/products/import/route.ts` | CSV 업로드 처리 |
| `src/app/api/admin/products/export/route.ts` | CSV 다운로드 + sample row |
| `src/lib/csv.ts` | CSV 직렬화/파싱 (BOM 처리) |
| `src/lib/lens-pricing-entries.ts` | 가격 이력 생성 + 캐시 동기 |
| `src/db/schema/lenses.ts` | lenses 테이블 스키마 (각 컬럼 타입 정의) |
