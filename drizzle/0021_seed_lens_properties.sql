-- 주요 제품 물성 일괄 시드 (공개 스펙 기준 근사값 — 추천 매칭용, 이후 보정 가능)
-- 매칭: product_code prefix. 블루라이트 차단 콘택트는 거의 없어 기본값(false) 유지.

-- 아큐브 오아시스 계열 (실리콘하이드로겔, UV차단, 고산소)
UPDATE lenses SET material='senofilcon A', oxygen_dkt=130, uv_protection=true, water_content='38.00', updated_at=NOW() WHERE product_code LIKE 'ACU-OA%' AND deleted_at IS NULL;--> statement-breakpoint
-- 아큐브 비타 (실리콘하이드로겔, UV)
UPDATE lenses SET material='senofilcon A', oxygen_dkt=147, uv_protection=true, water_content='38.00', updated_at=NOW() WHERE product_code LIKE 'ACU-VIT%' AND deleted_at IS NULL;--> statement-breakpoint
-- 아큐브 모이스트/디파인 (etafilcon A 하이드로겔, UV차단, 고함수)
UPDATE lenses SET material='etafilcon A', oxygen_dkt=26, uv_protection=true, water_content='58.00', updated_at=NOW() WHERE (product_code LIKE 'ACU-MO%' OR product_code LIKE 'ACU-D%') AND deleted_at IS NULL;--> statement-breakpoint
-- 알콘 토탈30 / 데일리스 토탈원 (실리콘하이드로겔 워터그라디언트, 초고산소)
UPDATE lenses SET material='delefilcon A', oxygen_dkt=156, uv_protection=false, water_content='33.00', updated_at=NOW() WHERE (product_code LIKE 'ALC-T30%' OR product_code LIKE 'ALC-DT%') AND deleted_at IS NULL;--> statement-breakpoint
-- 알콘 프리시전 (실리콘하이드로겔, UV)
UPDATE lenses SET material='verofilcon A', oxygen_dkt=100, uv_protection=true, water_content='51.00', updated_at=NOW() WHERE product_code LIKE 'ALC-PR%' AND deleted_at IS NULL;--> statement-breakpoint
-- 알콘 에어옵틱스 (실리콘하이드로겔)
UPDATE lenses SET material='lotrafilcon B', oxygen_dkt=138, uv_protection=false, water_content='33.00', updated_at=NOW() WHERE product_code LIKE 'ALC-A%' AND deleted_at IS NULL;--> statement-breakpoint
-- 알콘 데일리스 아쿠아 (하이드로겔, 고함수)
UPDATE lenses SET material='nelfilcon A', oxygen_dkt=26, uv_protection=false, water_content='69.00', updated_at=NOW() WHERE product_code LIKE 'ALC-DAC%' AND deleted_at IS NULL;--> statement-breakpoint
-- 알콘 후레쉬룩 (하이드로겔 컬러)
UPDATE lenses SET material='phemfilcon A', oxygen_dkt=20, uv_protection=false, water_content='55.00', updated_at=NOW() WHERE product_code LIKE 'ALC-F%' AND deleted_at IS NULL;--> statement-breakpoint
-- 바슈롬 울트라 (실리콘하이드로겔)
UPDATE lenses SET material='samfilcon A', oxygen_dkt=163, uv_protection=false, water_content='46.00', updated_at=NOW() WHERE (product_code LIKE 'BNL-UL%' OR product_code LIKE 'BNL-UD%') AND deleted_at IS NULL;--> statement-breakpoint
-- 바슈롬 바이오트루 (하이드로겔, 초고함수)
UPDATE lenses SET material='nesofilcon A', oxygen_dkt=42, uv_protection=false, water_content='78.00', updated_at=NOW() WHERE product_code LIKE 'BNL-BT%' AND deleted_at IS NULL;--> statement-breakpoint
-- 바슈롬 소프렌/내츄렐/레이셀/옵티마 (하이드로겔)
UPDATE lenses SET material='hydrogel', oxygen_dkt=22, uv_protection=false, water_content='55.00', updated_at=NOW() WHERE (product_code LIKE 'BNL-SP%' OR product_code LIKE 'BNL-N%' OR product_code LIKE 'BNL-R%' OR product_code LIKE 'BNL-OP%') AND deleted_at IS NULL;--> statement-breakpoint
-- 쿠퍼 바이오피니티 (실리콘하이드로겔)
UPDATE lenses SET material='comfilcon A', oxygen_dkt=160, uv_protection=false, water_content='48.00', updated_at=NOW() WHERE product_code LIKE 'COO-BIO%' AND deleted_at IS NULL;--> statement-breakpoint
-- 쿠퍼 마이데이 (실리콘하이드로겔)
UPDATE lenses SET material='stenfilcon A', oxygen_dkt=100, uv_protection=false, water_content='54.00', updated_at=NOW() WHERE product_code LIKE 'COO-MDY%' AND deleted_at IS NULL;--> statement-breakpoint
-- 쿠퍼 클래리티 (실리콘하이드로겔, UV)
UPDATE lenses SET material='somofilcon A', oxygen_dkt=86, uv_protection=true, water_content='56.00', updated_at=NOW() WHERE product_code LIKE 'COO-CLA%' AND deleted_at IS NULL;--> statement-breakpoint
-- 쿠퍼 프로클리어 (하이드로겔, 고함수)
UPDATE lenses SET material='omafilcon B', oxygen_dkt=42, uv_protection=false, water_content='60.00', updated_at=NOW() WHERE (product_code LIKE 'COO-PRO%' OR product_code LIKE 'COO-PCM%') AND deleted_at IS NULL;--> statement-breakpoint
-- 클라렌 O2O2 (실리콘하이드로겔)
UPDATE lenses SET material='silicone hydrogel', oxygen_dkt=80, uv_protection=false, water_content='47.00', updated_at=NOW() WHERE product_code LIKE 'CO2-%' AND deleted_at IS NULL;--> statement-breakpoint
-- 클라렌 (하이드로겔 컬러/투명)
UPDATE lenses SET material='hydrogel', oxygen_dkt=22, uv_protection=false, water_content='55.00', updated_at=NOW() WHERE product_code LIKE 'CLA-%' AND deleted_at IS NULL;--> statement-breakpoint
-- 미광 (하이드로겔)
UPDATE lenses SET material='hydrogel', oxygen_dkt=20, uv_protection=false, water_content='40.00', updated_at=NOW() WHERE product_code LIKE 'MIK-%' AND deleted_at IS NULL;
