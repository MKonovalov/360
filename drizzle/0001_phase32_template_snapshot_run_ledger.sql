CREATE TYPE "public"."analysis_actor_kind" AS ENUM('staff', 'workflow', 'system');--> statement-breakpoint
CREATE TYPE "public"."analysis_effort" AS ENUM('standard');--> statement-breakpoint
CREATE TYPE "public"."analysis_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled', 'pending_review', 'confirmed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."analysis_target_type" AS ENUM('company', 'persona');--> statement-breakpoint
CREATE TABLE "analysis_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"target_type" "analysis_target_type" NOT NULL,
	"status" "catalog_status" DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_template_key_unique" UNIQUE("key")
);--> statement-breakpoint
CREATE TABLE "analysis_template_version" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL REFERENCES "public"."analysis_template"("id"),
	"version" integer NOT NULL,
	"instruction" text NOT NULL,
	"supported_efforts" jsonb DEFAULT '["standard"]'::jsonb NOT NULL,
	"default_effort" "analysis_effort" DEFAULT 'standard' NOT NULL,
	"future_budget" jsonb DEFAULT '{"maxAttempts":2,"maxToolCalls":12,"maxExecutionSeconds":300,"maxSpendUsd":2.5}'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "analysis_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL REFERENCES "public"."analysis_template"("id"),
	"template_version_id" integer NOT NULL REFERENCES "public"."analysis_template_version"("id"),
	"subject_type" "analysis_target_type" NOT NULL,
	"subject_id" integer NOT NULL,
	"practice_area_id" integer NOT NULL REFERENCES "public"."practice_area"("id"),
	"status" "analysis_run_status" DEFAULT 'queued' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 2 NOT NULL,
	"created_by" text NOT NULL,
	"template_snapshot" jsonb NOT NULL,
	"subject_snapshot" jsonb NOT NULL,
	"checklist_snapshot" jsonb NOT NULL,
	"execution_snapshot" jsonb NOT NULL,
	"policy_snapshot" jsonb DEFAULT '{"schemaVersion":1,"mode":"phase32_noop","networkAccess":false,"writesAllowed":false,"effectiveMaxAttempts":1,"effectiveMaxToolCalls":0,"effectiveMaxExecutionSeconds":5,"effectiveMaxSpendUsd":0}'::jsonb NOT NULL,
	"safe_reason" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"terminal_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "analysis_run_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"analysis_run_id" integer NOT NULL REFERENCES "public"."analysis_run"("id"),
	"event_key" text NOT NULL,
	"from_status" "analysis_run_status",
	"to_status" "analysis_run_status" NOT NULL,
	"actor_kind" "analysis_actor_kind" NOT NULL,
	"actor_id" text NOT NULL,
	"safe_reason" text,
	"attempt" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_run_event_key_unique" UNIQUE("event_key")
);--> statement-breakpoint
CREATE INDEX "analysis_template_target_status_idx" ON "analysis_template" USING btree ("target_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "analysis_template_version_template_version_idx" ON "analysis_template_version" USING btree ("template_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "analysis_run_active_subject_template_idx" ON "analysis_run" USING btree ("subject_type","subject_id","template_id") WHERE "status" IN ('queued', 'running', 'pending_review');--> statement-breakpoint
CREATE INDEX "analysis_run_subject_history_idx" ON "analysis_run" USING btree ("subject_type","subject_id","created_at");--> statement-breakpoint
CREATE INDEX "analysis_run_template_version_idx" ON "analysis_run" USING btree ("template_version_id");--> statement-breakpoint
CREATE INDEX "analysis_run_event_run_created_idx" ON "analysis_run_event" USING btree ("analysis_run_id","created_at");
