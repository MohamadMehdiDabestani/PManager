ALTER TYPE "public"."notification_channel" ADD VALUE IF NOT EXISTS 'BALE' BEFORE 'EITAA';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "channel_preference" SET DEFAULT '["SMS","BALE","EITAA","EMAIL"]'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bale_chat_id" varchar(64);