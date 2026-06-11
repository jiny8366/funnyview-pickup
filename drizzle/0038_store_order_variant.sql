ALTER TABLE "store_order_items" ADD COLUMN IF NOT EXISTS "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD COLUMN IF NOT EXISTS "sphere" text;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD COLUMN IF NOT EXISTS "cylinder" text;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD COLUMN IF NOT EXISTS "axis" integer;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD COLUMN IF NOT EXISTS "add_power" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_variant_id_lens_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."lens_variants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
