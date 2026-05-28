ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'no_show';--> statement-breakpoint
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'returned';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'pickup_no_show';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'order_returned';
