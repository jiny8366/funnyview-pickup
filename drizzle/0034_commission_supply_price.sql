ALTER TABLE "store_product_commissions" ADD COLUMN IF NOT EXISTS "supply_price" numeric(10, 0);--> statement-breakpoint
ALTER TABLE "group_product_commissions" ADD COLUMN IF NOT EXISTS "supply_price" numeric(10, 0);--> statement-breakpoint
ALTER TABLE "store_product_commission_history" ADD COLUMN IF NOT EXISTS "old_supply_price" numeric(10, 0);--> statement-breakpoint
ALTER TABLE "store_product_commission_history" ADD COLUMN IF NOT EXISTS "new_supply_price" numeric(10, 0);
