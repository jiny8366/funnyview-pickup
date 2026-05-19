CREATE TABLE "lens_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lens_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"discount_amount" integer DEFAULT 0,
	"discount_percent" integer DEFAULT 0,
	"store_tier" text,
	"buy_qty" integer,
	"free_qty" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "standard_cost" integer;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "purchase_discount_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "purchase_discount_percent" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "standard_supply_price" integer;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "supply_discount_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "supply_discount_percent" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "recommended_retail_price" integer;--> statement-breakpoint
ALTER TABLE "lens_promotions" ADD CONSTRAINT "lens_promotions_lens_id_lenses_id_fk" FOREIGN KEY ("lens_id") REFERENCES "public"."lenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lens_promotions_lens_idx" ON "lens_promotions" USING btree ("lens_id");--> statement-breakpoint
CREATE INDEX "lens_promotions_kind_idx" ON "lens_promotions" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "lens_promotions_active_idx" ON "lens_promotions" USING btree ("is_active","starts_at","ends_at");