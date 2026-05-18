ALTER TABLE "lenses" ADD COLUMN "color_name" text;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "color_hex" text;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "color_preview_url" text;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "series_code" text;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "is_new" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "lenses_series_idx" ON "lenses" USING btree ("series_code");