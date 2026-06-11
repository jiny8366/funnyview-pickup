ALTER TABLE "urgent_purchases" ADD COLUMN IF NOT EXISTS "supplier_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "urgent_purchases" ADD CONSTRAINT "urgent_purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
