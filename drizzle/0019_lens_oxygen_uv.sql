ALTER TABLE "lenses" ADD COLUMN "oxygen_dkt" integer;--> statement-breakpoint
ALTER TABLE "lenses" ADD COLUMN "uv_protection" boolean DEFAULT false NOT NULL;
