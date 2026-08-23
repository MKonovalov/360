CREATE TYPE "public"."partner_callback_status" AS ENUM('succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."partner_job_status" AS ENUM('queued', 'running', 'cancelling', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "partner_callback_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_mapping_id" integer NOT NULL,
	"event_id" text NOT NULL,
	"request_id" text NOT NULL,
	"status" "partner_callback_status" NOT NULL,
	"payload_hash" text NOT NULL,
	"result" jsonb,
	"result_size_bytes" integer NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "partner_callback_event_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "partner_callback_event_payload_hash_check" CHECK ("partner_callback_event"."payload_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "partner_callback_event_result_size_check" CHECK ("partner_callback_event"."result_size_bytes" BETWEEN 0 AND 5242880)
);
--> statement-breakpoint
CREATE TABLE "partner_job_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_job_id" text NOT NULL,
	"request_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "partner_job_status" DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"result_size_bytes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"terminal_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "partner_job_mapping_partner_job_id_unique" UNIQUE("partner_job_id"),
	CONSTRAINT "partner_job_mapping_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "partner_job_mapping_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "partner_job_mapping_result_size_check" CHECK ("partner_job_mapping"."result_size_bytes" IS NULL OR "partner_job_mapping"."result_size_bytes" BETWEEN 0 AND 5242880)
);
--> statement-breakpoint
ALTER TABLE "partner_callback_event" ADD CONSTRAINT "partner_callback_event_job_mapping_id_partner_job_mapping_id_fk" FOREIGN KEY ("job_mapping_id") REFERENCES "public"."partner_job_mapping"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_callback_event_job_mapping_id_idx" ON "partner_callback_event" USING btree ("job_mapping_id","id");--> statement-breakpoint
CREATE INDEX "partner_callback_event_expires_at_idx" ON "partner_callback_event" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "partner_job_mapping_status_expires_at_idx" ON "partner_job_mapping" USING btree ("status","expires_at");
