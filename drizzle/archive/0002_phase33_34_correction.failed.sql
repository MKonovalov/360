CREATE TYPE "public"."analysis_confidence" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."analysis_evidence_status" AS ENUM('strong', 'weak', 'no_evidence', 'inconclusive');--> statement-breakpoint
CREATE TYPE "public"."analysis_retention_status" AS ENUM('retained', 'tombstoned');--> statement-breakpoint
CREATE TYPE "public"."analysis_source_classification" AS ENUM('public_biz', 'personal_data', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."analysis_support_role" AS ENUM('primary', 'corroborating');--> statement-breakpoint
CREATE TABLE "analysis_finding" (
	"id" serial PRIMARY KEY NOT NULL,
	"result_id" integer NOT NULL,
	"analysis_run_id" integer NOT NULL,
	"finding_id" text NOT NULL,
	"signal_id" integer NOT NULL,
	"signal_name" text NOT NULL,
	"signal_category" text NOT NULL,
	"buyer_role_id" integer,
	"status" "analysis_evidence_status" NOT NULL,
	"confidence" "analysis_confidence" NOT NULL,
	"claim" text NOT NULL,
	"reasoning_summary" text,
	"policy_version" text,
	"classification" "analysis_source_classification",
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_finding_result_finding_unique" UNIQUE("result_id","finding_id")
);
--> statement-breakpoint
CREATE TABLE "analysis_finding_source" (
	"id" serial PRIMARY KEY NOT NULL,
	"result_id" integer NOT NULL,
	"finding_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"locator" text,
	"support_role" "analysis_support_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_finding_source_finding_source_unique" UNIQUE("finding_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "analysis_result_retention" (
	"id" serial PRIMARY KEY NOT NULL,
	"result_id" integer NOT NULL,
	"policy_version" text NOT NULL,
	"classification" "analysis_source_classification" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"status" "analysis_retention_status" DEFAULT 'retained' NOT NULL,
	"tombstoned_at" timestamp,
	"tombstone_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_result_retention_result_id_unique" UNIQUE("result_id")
);
--> statement-breakpoint
CREATE TABLE "analysis_run_result" (
	"id" serial PRIMARY KEY NOT NULL,
	"analysis_run_id" integer NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"target_type" "analysis_target_type" NOT NULL,
	"narrative" text NOT NULL,
	"raw_audit" jsonb NOT NULL,
	"model_id" text,
	"model_chain" jsonb NOT NULL,
	"trace_id" text,
	"trace_url" text,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp NOT NULL,
	"duration_ms" integer NOT NULL,
	"finding_count" integer NOT NULL,
	"source_count" integer NOT NULL,
	"link_count" integer NOT NULL,
	"packet_hash" text NOT NULL,
	"policy_version" text,
	"classification" "analysis_source_classification",
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_run_result_analysis_run_id_unique" UNIQUE("analysis_run_id"),
	CONSTRAINT "analysis_run_result_packet_hash_unique" UNIQUE("packet_hash")
);
--> statement-breakpoint
CREATE TABLE "analysis_source" (
	"id" serial PRIMARY KEY NOT NULL,
	"result_id" integer NOT NULL,
	"source_id" text NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text NOT NULL,
	"retrieved_at" timestamp NOT NULL,
	"excerpt" text NOT NULL,
	"content_hash" text NOT NULL,
	"classification" "analysis_source_classification" NOT NULL,
	"provider_name" text,
	"provider_version" text,
	"policy_version" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_source_result_canonical_url_unique" UNIQUE("result_id","canonical_url"),
	CONSTRAINT "analysis_source_result_source_id_unique" UNIQUE("result_id","source_id")
);
--> statement-breakpoint
ALTER TABLE "analysis_run" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "analysis_run" ALTER COLUMN "status" SET DEFAULT 'queued'::text;--> statement-breakpoint
ALTER TABLE "analysis_run_event" ALTER COLUMN "from_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "analysis_run_event" ALTER COLUMN "to_status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."analysis_run_status";--> statement-breakpoint
CREATE TYPE "public"."analysis_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
ALTER TABLE "analysis_run" ALTER COLUMN "status" SET DEFAULT 'queued'::"public"."analysis_run_status";--> statement-breakpoint
ALTER TABLE "analysis_run" ALTER COLUMN "status" SET DATA TYPE "public"."analysis_run_status" USING "status"::"public"."analysis_run_status";--> statement-breakpoint
ALTER TABLE "analysis_run_event" ALTER COLUMN "from_status" SET DATA TYPE "public"."analysis_run_status" USING "from_status"::"public"."analysis_run_status";--> statement-breakpoint
ALTER TABLE "analysis_run_event" ALTER COLUMN "to_status" SET DATA TYPE "public"."analysis_run_status" USING "to_status"::"public"."analysis_run_status";--> statement-breakpoint
DROP INDEX "analysis_run_active_subject_template_idx";--> statement-breakpoint
DROP INDEX "signal_company_type_idx";--> statement-breakpoint
ALTER TABLE "signal" ALTER COLUMN "signal_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "signal_proposal" ALTER COLUMN "signal_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "signal" ADD COLUMN "signal_id" integer;--> statement-breakpoint
ALTER TABLE "signal" ADD COLUMN "signal_record_type" "record_type";--> statement-breakpoint
ALTER TABLE "signal_proposal" ADD COLUMN "signal_id" integer;--> statement-breakpoint
ALTER TABLE "signal_proposal" ADD COLUMN "signal_record_type" "record_type";--> statement-breakpoint
ALTER TABLE "signal_proposal" ADD COLUMN "demonstrated" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_finding" ADD CONSTRAINT "analysis_finding_result_id_analysis_run_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."analysis_run_result"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_finding" ADD CONSTRAINT "analysis_finding_analysis_run_id_analysis_run_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."analysis_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_finding_source" ADD CONSTRAINT "analysis_finding_source_result_id_analysis_run_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."analysis_run_result"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_finding_source" ADD CONSTRAINT "analysis_finding_source_finding_id_analysis_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."analysis_finding"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_finding_source" ADD CONSTRAINT "analysis_finding_source_source_id_analysis_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."analysis_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_result_retention" ADD CONSTRAINT "analysis_result_retention_result_id_analysis_run_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."analysis_run_result"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_run_result" ADD CONSTRAINT "analysis_run_result_analysis_run_id_analysis_run_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."analysis_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_source" ADD CONSTRAINT "analysis_source_result_id_analysis_run_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."analysis_run_result"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_finding_result_idx" ON "analysis_finding" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "analysis_finding_signal_idx" ON "analysis_finding" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "analysis_finding_source_result_idx" ON "analysis_finding_source" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "analysis_finding_source_finding_idx" ON "analysis_finding_source" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "analysis_finding_source_source_idx" ON "analysis_finding_source" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "analysis_result_retention_visibility_idx" ON "analysis_result_retention" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "analysis_run_result_run_idx" ON "analysis_run_result" USING btree ("analysis_run_id");--> statement-breakpoint
CREATE INDEX "analysis_source_result_idx" ON "analysis_source" USING btree ("result_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signal_company_signal_id_idx" ON "signal" USING btree ("company_id","signal_record_type","signal_id") WHERE "signal"."signal_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "analysis_run_active_subject_template_idx" ON "analysis_run" USING btree ("subject_type","subject_id","template_id") WHERE "analysis_run"."status" IN ('queued', 'running');--> statement-breakpoint
CREATE UNIQUE INDEX "signal_company_type_idx" ON "signal" USING btree ("company_id","signal_type") WHERE "signal"."signal_type" IS NOT NULL;
