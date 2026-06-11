CREATE TABLE IF NOT EXISTS "store_product_commission_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"lens_id" uuid NOT NULL,
	"brand" text,
	"product_name" text,
	"action" text NOT NULL,
	"old_rate" numeric(5, 2),
	"new_rate" numeric(5, 2),
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_product_commission_history_store_changed_idx" ON "store_product_commission_history" ("store_id","changed_at" DESC);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "store_product_commission_history" ADD CONSTRAINT "store_product_commission_history_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "store_product_commission_history" ADD CONSTRAINT "store_product_commission_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
