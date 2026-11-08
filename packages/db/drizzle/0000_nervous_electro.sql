CREATE TYPE "public"."actor_type" AS ENUM('USER', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."asset_criticality" AS ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('OPERATIONAL', 'UNDER_MAINTENANCE', 'DOWN', 'DECOMMISSIONED');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('SMS', 'EITAA', 'EMAIL', 'IN_APP', 'WEB_PUSH');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."work_order_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'PLANT_HEAD', 'MAINTENANCE_MANAGER', 'PLANNER', 'SUPERVISOR', 'TECHNICIAN', 'OPERATOR', 'AUDITOR');--> statement-breakpoint
CREATE TYPE "public"."schedule_anchor_mode" AS ENUM('FIXED', 'FLOATING');--> statement-breakpoint
CREATE TYPE "public"."schedule_trigger_type" AS ENUM('CALENDAR', 'METER', 'HYBRID');--> statement-breakpoint
CREATE TYPE "public"."work_order_status" AS ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'DONE', 'CANCELLED', 'OVERDUE');--> statement-breakpoint
CREATE TYPE "public"."work_order_type" AS ENUM('PM', 'CM', 'PDM');--> statement-breakpoint
CREATE TABLE "asset_meter_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_id" uuid NOT NULL,
	"reading" double precision NOT NULL,
	"recorded_by_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_id" varchar(64),
	CONSTRAINT "asset_meter_readings_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "asset_meters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"unit" varchar(32) NOT NULL,
	"current_reading" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"location_id" uuid,
	"parent_asset_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_normalized" varchar(200) NOT NULL,
	"serial_number" varchar(100),
	"qr_opaque_token" varchar(64) NOT NULL,
	"status" "asset_status" DEFAULT 'OPERATIONAL' NOT NULL,
	"criticality" "asset_criticality" DEFAULT 'MEDIUM' NOT NULL,
	"requires_loto" boolean DEFAULT false NOT NULL,
	"loto_procedure" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "assets_qr_opaque_token_unique" UNIQUE("qr_opaque_token")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid,
	"actor_type" "actor_type" DEFAULT 'USER' NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity" varchar(64) NOT NULL,
	"entity_id" varchar(64) NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"ip" varchar(64),
	"device_id" varchar(128),
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downtime_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"work_order_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"reason" text,
	"is_planned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"parent_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" varchar(150) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"work_order_id" uuid,
	"kind" varchar(64) NOT NULL,
	"priority" "work_order_priority" DEFAULT 'MEDIUM' NOT NULL,
	"channel" "notification_channel" DEFAULT 'SMS' NOT NULL,
	"status" "notification_status" DEFAULT 'PENDING' NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"link" varchar(255),
	"idempotency_key" varchar(128) NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_normalized" varchar(200) NOT NULL,
	"unit" varchar(32) DEFAULT 'عدد' NOT NULL,
	"quantity_on_hand" double precision DEFAULT 0 NOT NULL,
	"min_quantity" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(150) NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Tehran' NOT NULL,
	"working_days" jsonb DEFAULT '[6,0,1,2,3,4]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plants_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "pm_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"trigger_type" "schedule_trigger_type" DEFAULT 'CALENDAR' NOT NULL,
	"anchor_mode" "schedule_anchor_mode" DEFAULT 'FIXED' NOT NULL,
	"interval_days" integer,
	"meter_id" uuid,
	"interval_meter" double precision,
	"last_done_at" timestamp with time zone,
	"last_done_meter" double precision,
	"next_due_at" timestamp with time zone,
	"lead_days" integer DEFAULT 3 NOT NULL,
	"priority" "work_order_priority" DEFAULT 'MEDIUM' NOT NULL,
	"default_assignee_id" uuid,
	"reminder_offsets_min" jsonb DEFAULT '[-1440,0,60]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pm_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"estimated_minutes" integer DEFAULT 60 NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_ppe" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_plants" (
	"user_id" uuid NOT NULL,
	"plant_id" uuid NOT NULL,
	CONSTRAINT "user_plants_user_id_plant_id_pk" PRIMARY KEY("user_id","plant_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(64) NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"full_name_normalized" varchar(150) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"eitaa_chat_id" varchar(64),
	"password_hash" text NOT NULL,
	"pin_hash" text,
	"role" "user_role" DEFAULT 'TECHNICIAN' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"rules_version" integer DEFAULT 1 NOT NULL,
	"channel_preference" jsonb DEFAULT '["SMS","EITAA","EMAIL"]'::jsonb NOT NULL,
	"quiet_hours_start" varchar(5) DEFAULT '22:00',
	"quiet_hours_end" varchar(5) DEFAULT '06:00',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "work_order_part_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"quantity_used" double precision NOT NULL,
	"recorded_by_id" uuid,
	"client_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_order_part_usages_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plant_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"pm_schedule_id" uuid,
	"type" "work_order_type" DEFAULT 'PM' NOT NULL,
	"status" "work_order_status" DEFAULT 'OPEN' NOT NULL,
	"priority" "work_order_priority" DEFAULT 'MEDIUM' NOT NULL,
	"title" varchar(250) NOT NULL,
	"description" text,
	"assignee_id" uuid,
	"created_by_id" uuid,
	"due_at" timestamp with time zone NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"loto_verified" boolean DEFAULT false NOT NULL,
	"loto_lock_id" varchar(64),
	"loto_verified_by_id" uuid,
	"checklist_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checklist_result" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_id" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "work_orders_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
ALTER TABLE "asset_meter_readings" ADD CONSTRAINT "asset_meter_readings_meter_id_asset_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."asset_meters"("id") ON DELETE Cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_meter_readings" ADD CONSTRAINT "asset_meter_readings_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE SetNull ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_meters" ADD CONSTRAINT "asset_meters_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE Cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE SetNull ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE SetNull ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE SetNull ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE Cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE Cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_schedules" ADD CONSTRAINT "pm_schedules_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_schedules" ADD CONSTRAINT "pm_schedules_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_schedules" ADD CONSTRAINT "pm_schedules_template_id_pm_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."pm_templates"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_schedules" ADD CONSTRAINT "pm_schedules_meter_id_asset_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."asset_meters"("id") ON DELETE SetNull ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_schedules" ADD CONSTRAINT "pm_schedules_default_assignee_id_users_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."users"("id") ON DELETE SetNull ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_templates" ADD CONSTRAINT "pm_templates_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_plants" ADD CONSTRAINT "user_plants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE Cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_plants" ADD CONSTRAINT "user_plants_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE Cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_part_usages" ADD CONSTRAINT "work_order_part_usages_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE Cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_part_usages" ADD CONSTRAINT "work_order_part_usages_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_part_usages" ADD CONSTRAINT "work_order_part_usages_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE SetNull ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE Restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_pm_schedule_id_pm_schedules_id_fk" FOREIGN KEY ("pm_schedule_id") REFERENCES "public"."pm_schedules"("id") ON DELETE SetNull ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE SetNull ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SetNull ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_loto_verified_by_id_users_id_fk" FOREIGN KEY ("loto_verified_by_id") REFERENCES "public"."users"("id") ON DELETE SetNull ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meter_readings_meter_recorded_idx" ON "asset_meter_readings" USING btree ("meter_id","recorded_at");--> statement-breakpoint
CREATE INDEX "asset_meters_asset_idx" ON "asset_meters" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "assets_plant_status_idx" ON "assets" USING btree ("plant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_plant_code_uniq" ON "assets" USING btree ("plant_id","code");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_plant_at_idx" ON "audit_logs" USING btree ("plant_id","at");--> statement-breakpoint
CREATE INDEX "downtime_logs_asset_started_idx" ON "downtime_logs" USING btree ("asset_id","started_at");--> statement-breakpoint
CREATE INDEX "locations_plant_idx" ON "locations" USING btree ("plant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_plant_code_uniq" ON "locations" USING btree ("plant_id","code");--> statement-breakpoint
CREATE INDEX "notifications_user_status_idx" ON "notifications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "notifications_status_created_idx" ON "notifications" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "parts_plant_code_uniq" ON "parts" USING btree ("plant_id","code");--> statement-breakpoint
CREATE INDEX "pm_schedules_plant_active_due_idx" ON "pm_schedules" USING btree ("plant_id","active","next_due_at");--> statement-breakpoint
CREATE INDEX "pm_schedules_asset_idx" ON "pm_schedules" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "pm_templates_plant_idx" ON "pm_templates" USING btree ("plant_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "wo_part_usages_wo_idx" ON "work_order_part_usages" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "work_orders_plant_status_due_idx" ON "work_orders" USING btree ("plant_id","status","due_at");--> statement-breakpoint
CREATE INDEX "work_orders_assignee_status_idx" ON "work_orders" USING btree ("assignee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "work_orders_pm_schedule_due_uniq" ON "work_orders" USING btree ("pm_schedule_id","due_at");