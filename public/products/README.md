# 제품 이미지 업로드 가이드

브랜드 제품 이미지를 이 폴더에 넣으면 자동으로 DB의 `lenses.image_url` 에 반영됩니다.

## 워크플로우 (3단계)

### 1. 이미지 다운로드 + 저장

브랜드 사이트(또는 retailer 사이트)에서 제품 이미지를 받아 이 폴더에 저장합니다.

**파일명 규칙: `{productCode}.{확장자}`**

| 예시 파일명 | 매칭되는 product_code |
|---|---|
| `BNL-NSBCL-90P.jpg` | `BNL-NSBCL-90P` (바슈롬 시크브라운 90팩) |
| `BNL-RLGCL-30P.png` | `BNL-RLGCL-30P` (바슈롬 루미너스 그레이 30팩) |
| `ACU-DACCL-30P.webp` | `ACU-DACCL-30P` (아큐브 디파인 액센트 30팩) |

지원 확장자: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`

**productCode 확인 방법**:
- 관리자: https://admin-funnyview-pickup.vercel.app/admin/products (로그인 후)
- 카탈로그 API: `curl https://funnyview-pickup.vercel.app/api/catalog | jq '.lenses[].productCode'`

### 2. 마이그레이션 생성

```bash
npx tsx scripts/build-product-images-migration.ts
```

자동으로 처리:
- `public/products/` 폴더 스캔
- 각 파일을 `UPDATE lenses SET image_url='/products/...' WHERE product_code=...` 로 변환
- `drizzle/00XX_product_image_paths.sql` 마이그레이션 파일 생성
- `_journal.json` 업데이트 + snapshot 복사

### 3. 커밋 + 푸시

```bash
git add public/products/ drizzle/
git commit -m "feat: 제품 이미지 N개 추가"
git push origin main
```

Vercel 자동 빌드 → `drizzle-kit migrate` → DB `image_url` 컬럼 업데이트 → 모든 페이지에 실제 이미지 노출

## 권장 이미지 사양

| 항목 | 권장값 | 비고 |
|---|---|---|
| 비율 | 3:4 (세로) 또는 1:1 (정사각) | ProductCard 가 3:4 로 표시 |
| 해상도 | 600x800 ~ 1200x1600 | 너무 크면 LCP 영향 |
| 포맷 | WebP > JPG > PNG | WebP 가 가장 효율적 |
| 파일 크기 | < 200KB 권장 | CDN 캐시 + Lighthouse |
| 배경 | 깔끔한 단색 또는 그라디언트 | 브랜드 톤 유지 |

## 작동 원리

- `ProductCard` 와 쇼핑 페이지가 `imageUrl ?? /api/lens-image/{productCode}` 패턴으로 이미지 렌더
- `imageUrl` 이 채워지면 실제 이미지 표시, 빈 칸이면 SVG fallback
- 이 폴더는 Next.js `public/` 정적 서빙 → 브라우저가 `https://.../products/{file}` 로 직접 로드

## 이미지를 빼고 싶을 때

해당 row 만 `image_url = NULL` 로 되돌리면 다시 SVG fallback 으로 돌아갑니다. 새 마이그레이션으로:

```sql
UPDATE lenses SET image_url = NULL, updated_at = NOW() WHERE product_code = 'XXX-XXXXX-XXP';
```
