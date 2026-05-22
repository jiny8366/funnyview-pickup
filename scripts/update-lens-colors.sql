-- 컬러 콘택트렌즈 색상 정보 일괄 업데이트
-- 생성: 브랜드 공식사이트 조사 기반 (color_name, color_hex, is_new)
--
-- 실행 방법 (Mac 터미널):
--   source .env.local
--   psql $DATABASE_URL -f scripts/update-lens-colors.sql
--
-- 업데이트 대상: 80개 컬러 제품 (series_code 기준 일괄 적용)
-- 미반영 항목: image_url, color_preview_url (수동 입력 필요)

BEGIN;

-- ============================================================
-- 아큐브 Define (Acuvue Define) - 서클렌즈 7종 × 2팩 = 14제품
-- ============================================================
UPDATE lenses SET color_name = '엑센트',   color_hex = '#2C1810', updated_at = NOW()
WHERE series_code = 'ACU-DACCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '브라이트',  color_hex = '#9B7A5A', updated_at = NOW()
WHERE series_code = 'ACU-DBRCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '챠밍',     color_hex = '#9B9080', updated_at = NOW()
WHERE series_code = 'ACU-DCHCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '샤인',     color_hex = '#B8A080', updated_at = NOW()
WHERE series_code = 'ACU-DSHCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '시크',     color_hex = '#4A3020', updated_at = NOW()
WHERE series_code = 'ACU-DSKCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '스윗',     color_hex = '#8B5E3A', updated_at = NOW()
WHERE series_code = 'ACU-DSWCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '비비드',   color_hex = '#2C1F14', updated_at = NOW()
WHERE series_code = 'ACU-DVVCL' AND deleted_at IS NULL;

-- ============================================================
-- 알콘 FreshLook - 컬러 9종 × 1팩 = 9제품
-- ============================================================
UPDATE lenses SET color_name = '얼루어 블루',          color_hex = '#4169E1', updated_at = NOW()
WHERE series_code = 'ALC-FABCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '얼루어 그레이',         color_hex = '#808080', updated_at = NOW()
WHERE series_code = 'ALC-FAGCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '얼루어 헤이즐',         color_hex = '#8B6914', updated_at = NOW()
WHERE series_code = 'ALC-FAHCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '쥬얼 블랙',            color_hex = '#1C1C1C', updated_at = NOW()
WHERE series_code = 'ALC-FJBCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '쥬얼 골드',            color_hex = '#D4A820', updated_at = NOW()
WHERE series_code = 'ALC-FJGCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '일루미네이트 리치브라운', color_hex = '#6B3A2A', updated_at = NOW()
WHERE series_code = 'ALC-FRRCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '시크 카라멜',           color_hex = '#C68642', updated_at = NOW()
WHERE series_code = 'ALC-FSCCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '사틴 메이플',           color_hex = '#A0522D', updated_at = NOW()
WHERE series_code = 'ALC-FSMCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '시크 스모크',           color_hex = '#708090', updated_at = NOW()
WHERE series_code = 'ALC-FSSCL' AND deleted_at IS NULL;

-- ============================================================
-- 바슈롬 Lacelle - 컬러 18종 + Naturelle 2종 = 26제품
-- ============================================================
UPDATE lenses SET color_name = '오로라 블랙',    color_hex = '#1A1A2E', updated_at = NOW()
WHERE series_code = 'BNL-RABCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '오로라 브라운',   color_hex = '#8B5E3C', updated_at = NOW()
WHERE series_code = 'BNL-RAWCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '밤비 브라운',    color_hex = '#7B4F2E', updated_at = NOW()
WHERE series_code = 'BNL-RBBCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '베이비 브라운',   color_hex = '#A0705A', updated_at = NOW()
WHERE series_code = 'BNL-RBYCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '크리스탈 브라운', color_hex = '#7B5A3A', updated_at = NOW()
WHERE series_code = 'BNL-RCBCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '디어 브라운',    color_hex = '#6B4423', updated_at = NOW()
WHERE series_code = 'BNL-RDBCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '이터널 블랙',    color_hex = '#0A0A0A', updated_at = NOW()
WHERE series_code = 'BNL-REBCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '프리덤 허니',    color_hex = '#C8831A', updated_at = NOW()
WHERE series_code = 'BNL-RFHCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '글리터링 그레이', color_hex = '#808090', updated_at = NOW()
WHERE series_code = 'BNL-RGGCL' AND deleted_at IS NULL;

-- 2025 NEW: 루미너스 그레이
UPDATE lenses SET color_name = '루미너스 그레이', color_hex = '#A0A0A8', is_new = true, updated_at = NOW()
WHERE series_code = 'BNL-RLGCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '뮤즈 초코',     color_hex = '#4A2C2A', updated_at = NOW()
WHERE series_code = 'BNL-RMCCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '미스틱 그레이',  color_hex = '#696970', updated_at = NOW()
WHERE series_code = 'BNL-RMGCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '메리 모카',     color_hex = '#6F4E37', updated_at = NOW()
WHERE series_code = 'BNL-RMMCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '멜로우 브라운',  color_hex = '#8B6347', updated_at = NOW()
WHERE series_code = 'BNL-RMWCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '스파클링 블랙',  color_hex = '#1A1A1A', updated_at = NOW()
WHERE series_code = 'BNL-RSBCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '쉬머링 골드',   color_hex = '#B8860B', updated_at = NOW()
WHERE series_code = 'BNL-RSGCL' AND deleted_at IS NULL;

-- 2025 NEW: 스팟라이트 브라운
UPDATE lenses SET color_name = '스팟라이트 브라운', color_hex = '#7B5230', is_new = true, updated_at = NOW()
WHERE series_code = 'BNL-RSLCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '트윙클 브라운',  color_hex = '#8B6347', updated_at = NOW()
WHERE series_code = 'BNL-RTBCL' AND deleted_at IS NULL;

-- Bausch & Lomb Naturelle
UPDATE lenses SET color_name = '퓨어 블랙',    color_hex = '#0A0A0A', updated_at = NOW()
WHERE series_code = 'BNL-NPBCL' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '시크 브라운',   color_hex = '#5C3D2E', updated_at = NOW()
WHERE series_code = 'BNL-NSBCL' AND deleted_at IS NULL;

-- ============================================================
-- 클라렌 Iris - 컬러 11종 = 19제품 (토릭 포함)
-- ============================================================
UPDATE lenses SET color_name = '알리샤 브라운', color_hex = '#5C3A1E', updated_at = NOW()
WHERE series_code IN ('CLA-IAB1D', 'CLA-IABTR') AND deleted_at IS NULL;

UPDATE lenses SET color_name = '블루 문',     color_hex = '#4169E1', updated_at = NOW()
WHERE series_code = 'CLA-IBM1D' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '헤일로 브라운', color_hex = '#7B4F2E', updated_at = NOW()
WHERE series_code = 'CLA-IHBTR' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '헤일로 그레이', color_hex = '#909090', updated_at = NOW()
WHERE series_code = 'CLA-IHGTR' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '째즈 블랙',   color_hex = '#1A1A1A', updated_at = NOW()
WHERE series_code = 'CLA-IJB1D' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '라틴',       color_hex = '#8B6914', updated_at = NOW()
WHERE series_code = 'CLA-ILT1D' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '랩소디',     color_hex = '#8B5E3C', updated_at = NOW()
WHERE series_code = 'CLA-IRP1D' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '소울 브라운', color_hex = '#5C3A1E', updated_at = NOW()
WHERE series_code = 'CLA-ISB1D' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '수지 브라운', color_hex = '#7B5A3A', updated_at = NOW()
WHERE series_code = 'CLA-SZB1D' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '수지 그레이', color_hex = '#808080', updated_at = NOW()
WHERE series_code = 'CLA-SZG1D' AND deleted_at IS NULL;

-- ============================================================
-- 클라렌 Astra - 컬러 3종 = 3제품
-- ============================================================
UPDATE lenses SET color_name = '에스텔 브라운', color_hex = '#8B5E3C', updated_at = NOW()
WHERE series_code = 'CLA-AEB1D' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '에스텔 그레이', color_hex = '#909090', updated_at = NOW()
WHERE series_code = 'CLA-AEG1D' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '글리터',       color_hex = '#D4AF37', updated_at = NOW()
WHERE series_code = 'CLA-AGL1D' AND deleted_at IS NULL;

-- ============================================================
-- 미광 / ClearLab - 컬러 2종 = 2제품
-- ============================================================
UPDATE lenses SET color_name = '브라운', color_hex = '#8B6347', updated_at = NOW()
WHERE series_code = 'MIK-CESBR' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '그레이', color_hex = '#808080', updated_at = NOW()
WHERE series_code = 'MIK-CESGR' AND deleted_at IS NULL;

-- ============================================================
-- 클라렌 O2O2 - 컬러 5종 + 토릭 2종 = 7제품
-- ============================================================
UPDATE lenses SET color_name = '애쉬 브라운',   color_hex = '#8B6347', updated_at = NOW()
WHERE series_code IN ('CO2-O2BEX', 'CO2-O2BTR') AND deleted_at IS NULL;

UPDATE lenses SET color_name = '애쉬 그레이',   color_hex = '#808080', updated_at = NOW()
WHERE series_code = 'CO2-O2GEX' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '블랜딩 헤이즐', color_hex = '#8B6914', updated_at = NOW()
WHERE series_code = 'CO2-O2HEX' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '블랜딩 로즈',   color_hex = '#D2836E', updated_at = NOW()
WHERE series_code = 'CO2-O2REX' AND deleted_at IS NULL;

UPDATE lenses SET color_name = '세피아 초코',   color_hex = '#4A2C2A', updated_at = NOW()
WHERE series_code IN ('CO2-O2SEX', 'CO2-O2STR') AND deleted_at IS NULL;

COMMIT;

-- 결과 확인
SELECT
  series_code,
  product_code,
  name,
  color_name,
  color_hex,
  is_new,
  updated_at::date AS updated
FROM lenses
WHERE color_name IS NOT NULL
  AND deleted_at IS NULL
ORDER BY series_code, product_code;
