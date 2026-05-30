-- 가격 0 인 제품에 임의의 시세 기준값을 채워 테스트 가능하게 함.
-- 인터넷 픽업서비스 웹의 일반적 시세를 참고한 추정값 (교체주기 × 팩수 룰).
-- 운영 가격은 추후 admin 또는 엑셀 일괄 업로드로 보정.

-- 원데이 (1day)
UPDATE lenses SET price = 28000, updated_at = NOW() WHERE price = 0 AND replacement_cycle = '1day' AND pieces_per_box = 30 AND deleted_at IS NULL;--> statement-breakpoint
UPDATE lenses SET price = 75000, updated_at = NOW() WHERE price = 0 AND replacement_cycle = '1day' AND pieces_per_box = 90 AND deleted_at IS NULL;--> statement-breakpoint
UPDATE lenses SET price = 12000, updated_at = NOW() WHERE price = 0 AND replacement_cycle = '1day' AND pieces_per_box = 10 AND deleted_at IS NULL;--> statement-breakpoint
UPDATE lenses SET price = 35000, updated_at = NOW() WHERE price = 0 AND replacement_cycle = '1day' AND pieces_per_box = 40 AND deleted_at IS NULL;--> statement-breakpoint
UPDATE lenses SET price = 68000, updated_at = NOW() WHERE price = 0 AND replacement_cycle = '1day' AND pieces_per_box = 80 AND deleted_at IS NULL;--> statement-breakpoint

-- 2주 (2week)
UPDATE lenses SET price = 25000, updated_at = NOW() WHERE price = 0 AND replacement_cycle = '2week' AND pieces_per_box = 6 AND deleted_at IS NULL;--> statement-breakpoint
UPDATE lenses SET price = 48000, updated_at = NOW() WHERE price = 0 AND replacement_cycle = '2week' AND pieces_per_box = 12 AND deleted_at IS NULL;--> statement-breakpoint

-- 1개월 (1month)
UPDATE lenses SET price = 12000, updated_at = NOW() WHERE price = 0 AND replacement_cycle = '1month' AND pieces_per_box = 1 AND deleted_at IS NULL;--> statement-breakpoint
UPDATE lenses SET price = 60000, updated_at = NOW() WHERE price = 0 AND replacement_cycle = '1month' AND pieces_per_box = 6 AND deleted_at IS NULL;--> statement-breakpoint
UPDATE lenses SET price = 22000, updated_at = NOW() WHERE price = 0 AND replacement_cycle = '1month' AND pieces_per_box = 2 AND deleted_at IS NULL;--> statement-breakpoint

-- 그 외 (3month/6month/1year 또는 매칭 안 된 케이스) 기본값
UPDATE lenses SET price = 30000, updated_at = NOW() WHERE price = 0 AND deleted_at IS NULL;
