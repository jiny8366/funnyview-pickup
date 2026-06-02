# 상품 대표이미지 소스 (M1 → M3 자동 파이프라인)

M1: 제조사 **공식 이미지**를 **`{제품코드}.png`**(또는 jpg/jpeg/webp) 형태로 이 폴더에 넣고 commit/push.
  - 예: `ACU-DACCL-30P.png` (제품코드는 catalog/상세의 productCode)
  - 편집 불필요(원본 그대로). 정사각·여백·압축은 스크립트가 처리.

M3: `npx tsx scripts/process-product-images.ts` 실행 →
  sips 600x600 흰배경 규격화 → `public/products/{코드}.jpg` → Supabase `image_url` 일괄 적용.
