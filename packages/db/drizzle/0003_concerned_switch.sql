DO $$ BEGIN
    CREATE TYPE "public"."failure_code_category" AS ENUM('SYMPTOM', 'COMPONENT', 'ROOT_CAUSE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."failure_industry_type" AS ENUM('TILE', 'PELLETIZING', 'GENERAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "failure_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"category" "failure_code_category" NOT NULL,
	"title_fa" varchar(200) NOT NULL,
	"industry_type" "failure_industry_type" DEFAULT 'GENERAL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "failure_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "symptom_code_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "component_code_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "root_cause_code_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "is_suspicious_inspection" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "suspicion_reason_fa" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "is_rework" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "failure_codes_category_industry_idx" ON "failure_codes" USING btree ("category","industry_type");--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_symptom_code_id_failure_codes_id_fk" FOREIGN KEY ("symptom_code_id") REFERENCES "public"."failure_codes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_component_code_id_failure_codes_id_fk" FOREIGN KEY ("component_code_id") REFERENCES "public"."failure_codes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_root_cause_code_id_failure_codes_id_fk" FOREIGN KEY ("root_cause_code_id") REFERENCES "public"."failure_codes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
