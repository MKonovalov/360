CREATE TYPE "public"."search_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."search_candidate_status" AS ENUM('pending', 'inconclusive', 'ambiguous_match', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "company_persona_role" ADD CONSTRAINT "company_persona_role_company_persona_unique" UNIQUE("company_id","persona_id");--> statement-breakpoint
CREATE TABLE "company_persona_role_buyer_role" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_persona_role_id" integer NOT NULL,
	"buyer_role_id" integer NOT NULL,
	CONSTRAINT "company_persona_role_buyer_role_unique" UNIQUE("company_persona_role_id","buyer_role_id")
);
--> statement-breakpoint
CREATE TABLE "search_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"status" "catalog_status" DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_template_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "search_template_version" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"resolved_instructions" text NOT NULL,
	"buyer_role_rules" jsonb NOT NULL,
	"evidence_policy" jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"status" "catalog_status" DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_template_version_template_version_unique" UNIQUE("template_id","version")
);
--> statement-breakpoint
CREATE TABLE "search_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"initiating_user_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"input_fingerprint" text NOT NULL,
	"company_id" integer NOT NULL,
	"template_version_id" integer NOT NULL,
	"company_snapshot" jsonb NOT NULL,
	"template_snapshot" jsonb NOT NULL,
	"buyer_role_snapshot" jsonb NOT NULL,
	"evidence_policy_snapshot" jsonb NOT NULL,
	"partner_job_mapping_id" integer,
	"status" "search_run_status" DEFAULT 'queued' NOT NULL,
	"packet_hash" text,
	"packet_schema_version" integer,
	"terminal_result_summary" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"terminal_at" timestamp,
	CONSTRAINT "search_run_actor_idempotency_unique" UNIQUE("initiating_user_id","idempotency_key"),
	CONSTRAINT "search_run_input_fingerprint_check" CHECK ("search_run"."input_fingerprint" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "search_run_packet_hash_check" CHECK ("search_run"."packet_hash" IS NULL OR "search_run"."packet_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "search_candidate" (
	"id" serial PRIMARY KEY NOT NULL,
	"search_run_id" integer NOT NULL,
	"packet_candidate_id" text NOT NULL,
	"matched_persona_id" integer,
	"persona_snapshot" jsonb NOT NULL,
	"buyer_role_snapshot" jsonb NOT NULL,
	"match_snapshot" jsonb NOT NULL,
	"eligibility_snapshot" jsonb NOT NULL,
	"status" "search_candidate_status" DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"edit_count" integer DEFAULT 0 NOT NULL,
	"last_edited_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_candidate_run_packet_id_unique" UNIQUE("search_run_id","packet_candidate_id")
);
--> statement-breakpoint
CREATE TABLE "search_candidate_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"search_candidate_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"revision" integer NOT NULL,
	"changes" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_candidate_source" (
	"id" serial PRIMARY KEY NOT NULL,
	"search_candidate_id" integer NOT NULL,
	"packet_source_id" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"published_at" timestamp,
	"accessed_at" timestamp,
	"supports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "search_candidate_source_packet_id_unique" UNIQUE("search_candidate_id","packet_source_id")
);
--> statement-breakpoint
ALTER TABLE "company_persona_role_buyer_role" ADD CONSTRAINT "company_persona_role_buyer_role_company_persona_role_id_company_persona_role_id_fk" FOREIGN KEY ("company_persona_role_id") REFERENCES "public"."company_persona_role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_persona_role_buyer_role" ADD CONSTRAINT "company_persona_role_buyer_role_buyer_role_id_buyer_role_id_fk" FOREIGN KEY ("buyer_role_id") REFERENCES "public"."buyer_role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_template_version" ADD CONSTRAINT "search_template_version_template_id_search_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."search_template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_run" ADD CONSTRAINT "search_run_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_run" ADD CONSTRAINT "search_run_template_version_id_search_template_version_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."search_template_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_run" ADD CONSTRAINT "search_run_partner_job_mapping_id_partner_job_mapping_id_fk" FOREIGN KEY ("partner_job_mapping_id") REFERENCES "public"."partner_job_mapping"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_candidate" ADD CONSTRAINT "search_candidate_search_run_id_search_run_id_fk" FOREIGN KEY ("search_run_id") REFERENCES "public"."search_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_candidate" ADD CONSTRAINT "search_candidate_matched_persona_id_persona_id_fk" FOREIGN KEY ("matched_persona_id") REFERENCES "public"."persona"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_candidate_audit" ADD CONSTRAINT "search_candidate_audit_search_candidate_id_search_candidate_id_fk" FOREIGN KEY ("search_candidate_id") REFERENCES "public"."search_candidate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_candidate_source" ADD CONSTRAINT "search_candidate_source_search_candidate_id_search_candidate_id_fk" FOREIGN KEY ("search_candidate_id") REFERENCES "public"."search_candidate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_template_status_idx" ON "search_template" USING btree ("status");--> statement-breakpoint
CREATE INDEX "search_template_version_status_idx" ON "search_template_version" USING btree ("template_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "search_run_active_company_template_idx" ON "search_run" USING btree ("company_id","template_version_id") WHERE "search_run"."status" IN ('queued', 'running');--> statement-breakpoint
CREATE INDEX "search_run_status_idx" ON "search_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "search_run_company_template_idx" ON "search_run" USING btree ("company_id","template_version_id","created_at");--> statement-breakpoint
CREATE INDEX "search_run_partner_mapping_idx" ON "search_run" USING btree ("partner_job_mapping_id");--> statement-breakpoint
CREATE INDEX "search_candidate_status_idx" ON "search_candidate" USING btree ("search_run_id","status");--> statement-breakpoint
CREATE INDEX "search_candidate_run_order_idx" ON "search_candidate" USING btree ("search_run_id","id");--> statement-breakpoint
CREATE INDEX "search_candidate_audit_order_idx" ON "search_candidate_audit" USING btree ("search_candidate_id","created_at","id");--> statement-breakpoint
CREATE INDEX "search_candidate_source_order_idx" ON "search_candidate_source" USING btree ("search_candidate_id","id");--> statement-breakpoint
