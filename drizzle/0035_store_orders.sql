CREATE TABLE IF NOT EXISTS "store_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"status" text DEFAULT 'placed' NOT NULL,
	"total_supply_amount" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"lens_id" uuid NOT NULL,
	"brand" text,
	"product_name" text,
	"product_code" text,
	"quantity" integer NOT NULL,
	"unit_supply_price" integer NOT NULL,
	"line_total" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_orders_store_created_idx" ON "store_orders" ("store_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_order_items_order_idx" ON "store_order_items" ("order_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_order_id_store_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."store_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
