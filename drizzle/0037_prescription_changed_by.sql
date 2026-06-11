ALTER TABLE "customer_prescriptions" ADD COLUMN IF NOT EXISTS "changed_by_store_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_prescriptions" ADD COLUMN IF NOT EXISTS "changed_by_store_name" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_prescriptions" ADD CONSTRAINT "customer_prescriptions_changed_by_store_fk" FOREIGN KEY ("changed_by_store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
