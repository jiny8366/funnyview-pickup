ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "store_role" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" text;
--> statement-breakpoint
-- 기존 store_staff 계정은 대표자(owner)로 간주(소급) — 안경사는 이후 신규 생성
UPDATE "users" SET "store_role" = 'owner' WHERE "role" = 'store_staff' AND "store_role" IS NULL;
