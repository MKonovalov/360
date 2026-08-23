CREATE TYPE "public"."analysis_execution_target" AS ENUM('internal', 'arc-agentnet');--> statement-breakpoint
CREATE TYPE "public"."arc_agentnet_local_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."arc_agentnet_safe_reason" AS ENUM('completed', 'execution_failed', 'cancelled', 'job_expired', 'status_unavailable', 'rate_limited', 'capacity_unavailable', 'persistence_unavailable');--> statement-breakpoint
CREATE TABLE "arc_agentnet_idempotency" (
	"id" serial PRIMARY KEY NOT NULL,
	"initiating_user_id" text NOT NULL,
	"company_id" integer NOT NULL,
	"template_id" integer NOT NULL,
	"template_version_id" integer NOT NULL,
	"execution_target" "analysis_execution_target" DEFAULT 'arc-agentnet' NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload_hash" text NOT NULL,
	"analysis_run_id" integer NOT NULL,
	"partner_job_mapping_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
 CONSTRAINT "arc_agentnet_idempotency_scope_key_unique" UNIQUE("initiating_user_id","company_id","template_id","template_version_id","execution_target","idempotency_key"),
 CONSTRAINT "arc_agentnet_idempotency_target_check" CHECK ("arc_agentnet_idempotency"."execution_target" = 'arc-agentnet'),
 CONSTRAINT "arc_agentnet_idempotency_scope_values_check" CHECK ("arc_agentnet_idempotency"."initiating_user_id" <> '' AND "arc_agentnet_idempotency"."company_id" > 0 AND "arc_agentnet_idempotency"."template_id" > 0 AND "arc_agentnet_idempotency"."template_version_id" > 0 AND "arc_agentnet_idempotency"."idempotency_key" <> ''),
 CONSTRAINT "arc_agentnet_idempotency_payload_hash_check" CHECK ("arc_agentnet_idempotency"."payload_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "execution_target" "analysis_execution_target" DEFAULT 'internal' NOT NULL;--> statement-breakpoint
UPDATE "analysis_run" SET "execution_target" = 'internal' WHERE "execution_target" IS NULL;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "initiating_user_id" text;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_template_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_checklist_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_input_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "partner_job_mapping_id" integer;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "partner_job_id" text;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "partner_request_id" text;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_idempotency_key" text;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_payload_hash" text;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_local_status" "arc_agentnet_local_status";--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_safe_reason" "arc_agentnet_safe_reason";--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_terminal_at" timestamp;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_result_hash" text;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_result_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "arc_agentnet_result_projection" jsonb;--> statement-breakpoint
ALTER TABLE "arc_agentnet_idempotency" ADD CONSTRAINT "arc_agentnet_idempotency_analysis_run_id_analysis_run_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."analysis_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arc_agentnet_idempotency" ADD CONSTRAINT "arc_agentnet_idempotency_partner_job_mapping_id_partner_job_mapping_id_fk" FOREIGN KEY ("partner_job_mapping_id") REFERENCES "public"."partner_job_mapping"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arc_agentnet_idempotency_run_idx" ON "arc_agentnet_idempotency" USING btree ("analysis_run_id");--> statement-breakpoint
ALTER TABLE "analysis_run" ADD CONSTRAINT "analysis_run_partner_job_mapping_id_partner_job_mapping_id_fk" FOREIGN KEY ("partner_job_mapping_id") REFERENCES "public"."partner_job_mapping"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_run" ADD CONSTRAINT "analysis_run_arc_agentnet_payload_hash_check" CHECK ("analysis_run"."arc_agentnet_payload_hash" IS NULL OR "analysis_run"."arc_agentnet_payload_hash" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "analysis_run" ADD CONSTRAINT "analysis_run_arc_agentnet_result_hash_check" CHECK ("analysis_run"."arc_agentnet_result_hash" IS NULL OR "analysis_run"."arc_agentnet_result_hash" ~ '^[a-f0-9]{64}$');--> statement-breakpoint
ALTER TABLE "analysis_run" ADD CONSTRAINT "analysis_run_arc_agentnet_result_size_check" CHECK ("analysis_run"."arc_agentnet_result_size_bytes" IS NULL OR "analysis_run"."arc_agentnet_result_size_bytes" BETWEEN 0 AND 5242880);
--> statement-breakpoint
ALTER TABLE "analysis_run" ADD CONSTRAINT "analysis_run_arc_agentnet_required_fields_check" CHECK (
  "analysis_run"."execution_target" = 'internal' OR (
    "analysis_run"."subject_type" = 'company' AND
    "analysis_run"."status" IN ('queued', 'running', 'completed', 'failed', 'cancelled') AND
    "analysis_run"."initiating_user_id" IS NOT NULL AND
    "analysis_run"."arc_agentnet_template_snapshot" IS NOT NULL AND
    "analysis_run"."arc_agentnet_checklist_snapshot" IS NOT NULL AND
    "analysis_run"."arc_agentnet_input_snapshot" IS NOT NULL AND
    "analysis_run"."partner_job_mapping_id" IS NOT NULL AND
    "analysis_run"."partner_job_id" IS NOT NULL AND
    "analysis_run"."partner_request_id" IS NOT NULL AND
    "analysis_run"."arc_agentnet_idempotency_key" IS NOT NULL AND
    "analysis_run"."arc_agentnet_payload_hash" IS NOT NULL AND
    "analysis_run"."arc_agentnet_local_status" IS NOT NULL
  )
);
