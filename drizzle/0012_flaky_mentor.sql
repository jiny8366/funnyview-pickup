CREATE TABLE "lens_price_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lens_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"standard" integer NOT NULL,
	"discount_amount" integer DEFAULT 0,
	"discount_percent" integer DEFAULT 0,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lens_price_entries" ADD CONSTRAINT "lens_price_entries_lens_id_lenses_id_fk" FOREIGN KEY ("lens_id") REFERENCES "public"."lenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lens_price_entries_lens_scope_idx" ON "lens_price_entries" USING btree ("lens_id","scope");--> statement-breakpoint
CREATE INDEX "lens_price_entries_active_idx" ON "lens_price_entries" USING btree ("is_active","starts_at","ends_at");