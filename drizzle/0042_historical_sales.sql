CREATE TABLE IF NOT EXISTS "historical_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"sold_on" date NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "historical_sales" ADD CONSTRAINT "historical_sales_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."lens_variants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "historical_sales" ADD CONSTRAINT "historical_sales_quantity_positive" CHECK ("quantity" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "historical_sales_variant_sold_idx" ON "historical_sales" ("variant_id","sold_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "historical_sales_sold_on_idx" ON "historical_sales" ("sold_on");
