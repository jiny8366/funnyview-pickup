CREATE TABLE IF NOT EXISTS "supplier_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" text DEFAULT 'ordered' NOT NULL,
	"total_cost" integer DEFAULT 0 NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"brand" text,
	"product_name" text,
	"sku" text,
	"sphere" text,
	"cylinder" text,
	"axis" integer,
	"add_power" text,
	"quantity" integer NOT NULL,
	"unit_cost" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_order_items" ADD CONSTRAINT "supplier_order_items_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."supplier_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_order_items" ADD CONSTRAINT "supplier_order_items_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."lens_variants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supplier_orders_order_number_unique" ON "supplier_orders" ("order_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_orders_supplier_idx" ON "supplier_orders" ("supplier_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_orders_status_idx" ON "supplier_orders" ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_order_items_order_idx" ON "supplier_order_items" ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supplier_order_items_variant_idx" ON "supplier_order_items" ("variant_id");
