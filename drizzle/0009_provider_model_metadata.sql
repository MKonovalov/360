ALTER TABLE "agent_run" ADD COLUMN "model_provider" text;--> statement-breakpoint
ALTER TABLE "user_model_settings" ADD COLUMN "primary_provider" text;--> statement-breakpoint
ALTER TABLE "user_model_settings" ADD COLUMN "fallback_providers" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_run_result" ADD COLUMN "model_provider" text;--> statement-breakpoint
