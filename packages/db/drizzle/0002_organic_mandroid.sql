DO $$ BEGIN
    CREATE TYPE "public"."asset_topology_type" AS ENUM('BOTTLENECK', 'BUFFERED', 'PARALLEL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "topology_type" "asset_topology_type" DEFAULT 'BOTTLENECK' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "buffer_capacity_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "capacity_impact_percent" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "hourly_lost_margin_rials" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "cold_startup_threshold_minutes" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "restart_energy_and_setup_cost_rials" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "in_line_scrap_cost_rials" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN IF NOT EXISTS "unit_price_rials" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "labor_hourly_rate_rials" bigint DEFAULT 2000000 NOT NULL;
