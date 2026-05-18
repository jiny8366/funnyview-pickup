ALTER TABLE "customers" ADD COLUMN "landline_phone" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "member_type" text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "refund_bank" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username") WHERE username IS NOT NULL AND deleted_at IS NULL;