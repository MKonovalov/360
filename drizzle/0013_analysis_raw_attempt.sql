CREATE TABLE "analysis_raw_attempt" (
	"id" serial PRIMARY KEY NOT NULL,
	"analysis_run_id" integer NOT NULL,
	"attempt" integer NOT NULL,
	"failure_stage" text NOT NULL,
	"status" text DEFAULT 'failed' NOT NULL,
	"safe_reason" text NOT NULL,
	"model_provider" text,
	"model_id" text,
	"artifact" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"schema_version" integer NOT NULL,
	"redaction_version" integer NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "analysis_raw_attempt_replay_key_unique" UNIQUE("analysis_run_id","attempt","failure_stage"),
	CONSTRAINT "analysis_raw_attempt_attempt_check" CHECK ("analysis_raw_attempt"."attempt" >= 0),
	CONSTRAINT "analysis_raw_attempt_status_check" CHECK ("analysis_raw_attempt"."status" = 'failed'),
	CONSTRAINT "analysis_raw_attempt_payload_hash_check" CHECK ("analysis_raw_attempt"."payload_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "analysis_raw_attempt_artifact_size_check" CHECK (("analysis_raw_attempt"."artifact"->'bytes'->>'serialized')::integer BETWEEN 0 AND 262144),
	CONSTRAINT "analysis_raw_attempt_schema_version_check" CHECK ("analysis_raw_attempt"."schema_version" = ("analysis_raw_attempt"."artifact"->>'schemaVersion')::integer),
	CONSTRAINT "analysis_raw_attempt_redaction_version_check" CHECK ("analysis_raw_attempt"."redaction_version" = ("analysis_raw_attempt"."artifact"->>'redactionVersion')::integer)
);
--> statement-breakpoint
ALTER TABLE "analysis_raw_attempt" ADD CONSTRAINT "analysis_raw_attempt_analysis_run_id_analysis_run_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."analysis_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_raw_attempt_run_attempt_stage_idx" ON "analysis_raw_attempt" USING btree ("analysis_run_id","attempt","failure_stage");--> statement-breakpoint
CREATE INDEX "analysis_raw_attempt_expires_at_idx" ON "analysis_raw_attempt" USING btree ("expires_at");
