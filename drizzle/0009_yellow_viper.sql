CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ko" text NOT NULL,
	"name_en" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "brands_name_ko_idx" ON "brands" USING btree ("name_ko") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_code_idx" ON "brands" USING btree ("code") WHERE deleted_at IS NULL;