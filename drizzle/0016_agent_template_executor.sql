ALTER TABLE "analysis_template_version" ADD COLUMN "executor" "analysis_execution_target" DEFAULT 'internal';--> statement-breakpoint
UPDATE "analysis_template_version" SET "executor" = 'internal' WHERE "executor" IS NULL;--> statement-breakpoint
ALTER TABLE "analysis_template_version" ALTER COLUMN "executor" SET NOT NULL;--> statement-breakpoint
