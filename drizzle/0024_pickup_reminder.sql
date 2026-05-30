ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'pickup_reminder';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_reminder_at" timestamp with time zone;
