ALTER TABLE "lens_variants" ADD COLUMN "udi_di" text;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "mfds_permit_no" text;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "mfds_classification_code" text;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "mfds_product_name" text;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "manufacturer" text;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "udi_synced_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "lens_variants_udi_di_unique" ON "lens_variants" USING btree ("udi_di");