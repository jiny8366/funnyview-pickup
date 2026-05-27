UPDATE customers SET member_type = 'online' WHERE member_type NOT IN ('online', 'offline');--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "member_type" SET DEFAULT 'online';
