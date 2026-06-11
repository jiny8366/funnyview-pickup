ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "ordered_by_store_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "orders" ADD CONSTRAINT "orders_ordered_by_store_fk" FOREIGN KEY ("ordered_by_store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
