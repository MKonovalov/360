CREATE TYPE "public"."analysis_template_kind" AS ENUM('fixed', 'custom');--> statement-breakpoint
ALTER TABLE "analysis_template" ADD COLUMN "kind" "analysis_template_kind" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_template" ADD COLUMN "practice_area_id" integer;--> statement-breakpoint
ALTER TABLE "analysis_template" ADD CONSTRAINT "analysis_template_practice_area_id_practice_area_id_fk" FOREIGN KEY ("practice_area_id") REFERENCES "public"."practice_area"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;--> statement-breakpoint
UPDATE "analysis_template" SET "kind" = 'fixed' WHERE "kind" IS NULL;--> statement-breakpoint
ALTER TABLE "analysis_template" ADD CONSTRAINT "analysis_template_kind_practice_area_check" CHECK ("kind" = 'custom' OR "practice_area_id" IS NULL);--> statement-breakpoint
ALTER TABLE "analysis_template_version" ADD COLUMN "kind" "analysis_template_kind" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_template_version" ADD COLUMN "custom_name" text;--> statement-breakpoint
ALTER TABLE "analysis_template_version" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "analysis_template_version" ADD COLUMN "research_query" text;--> statement-breakpoint
ALTER TABLE "analysis_template_version" ADD COLUMN "behavior_instruction" text;--> statement-breakpoint
ALTER TABLE "analysis_template_version" ADD COLUMN "structured_output_schema" jsonb;--> statement-breakpoint
ALTER TABLE "analysis_template_version" ADD COLUMN "capability_preset_ids" jsonb;--> statement-breakpoint
ALTER TABLE "analysis_template_version" ALTER COLUMN "instruction" DROP NOT NULL;--> statement-breakpoint
UPDATE "analysis_template_version" SET "kind" = 'fixed' WHERE "kind" IS NULL;--> statement-breakpoint
ALTER TABLE "analysis_template_version" ADD CONSTRAINT "analysis_template_version_custom_payload_check" CHECK (
  ("kind" = 'fixed'
    AND "instruction" IS NOT NULL
    AND "custom_name" IS NULL
    AND "description" IS NULL
    AND "research_query" IS NULL
    AND "behavior_instruction" IS NULL
    AND "structured_output_schema" IS NULL
    AND "capability_preset_ids" IS NULL)
  OR
  ("kind" = 'custom'
    AND "instruction" IS NULL
    AND "custom_name" IS NOT NULL
    AND "description" IS NOT NULL
    AND "research_query" IS NOT NULL
    AND "behavior_instruction" IS NOT NULL
    AND "capability_preset_ids" IS NOT NULL)
);--> statement-breakpoint
CREATE INDEX "analysis_template_kind_status_idx" ON "analysis_template" USING btree ("kind", "status");--> statement-breakpoint
CREATE INDEX "analysis_template_practice_area_idx" ON "analysis_template" USING btree ("practice_area_id");--> statement-breakpoint
