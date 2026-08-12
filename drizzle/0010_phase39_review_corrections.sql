CREATE TABLE "analysis_run_review_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"analysis_run_id" integer NOT NULL,
	"result_id" integer NOT NULL,
	"sequence" integer NOT NULL,
	"prior_decision" "analysis_review_decision",
	"decision" "analysis_review_decision" NOT NULL,
	"expected_prior_event_id" integer DEFAULT 0 NOT NULL,
	"decided_by" text NOT NULL,
	"decided_at" timestamp NOT NULL,
	"packet_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_run_review_event_run_sequence_unique" UNIQUE("analysis_run_id","sequence"),
	CONSTRAINT "analysis_run_review_event_replay_unique" UNIQUE("analysis_run_id","packet_hash","decision","expected_prior_event_id")
);
--> statement-breakpoint
ALTER TABLE "analysis_run_review" ADD COLUMN "effective_event_id" integer;--> statement-breakpoint
ALTER TABLE "analysis_run_review" ADD COLUMN "effective_sequence" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_run_review_event" ADD CONSTRAINT "analysis_run_review_event_analysis_run_id_analysis_run_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."analysis_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_run_review_event" ADD CONSTRAINT "analysis_run_review_event_result_id_analysis_run_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."analysis_run_result"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_run_review_event_run_id_idx" ON "analysis_run_review_event" USING btree ("analysis_run_id","id");--> statement-breakpoint
CREATE INDEX "analysis_run_review_event_result_id_idx" ON "analysis_run_review_event" USING btree ("result_id","id");
--> statement-breakpoint
ALTER TABLE "analysis_run_review" ADD CONSTRAINT "analysis_run_review_effective_event_id_fk" FOREIGN KEY ("effective_event_id") REFERENCES "analysis_run_review_event"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "analysis_run_review_event" (
	"analysis_run_id", "result_id", "sequence", "prior_decision", "decision",
	"expected_prior_event_id", "decided_by", "decided_at", "packet_hash", "created_at"
)
SELECT "analysis_run_id", "result_id", 1, NULL, "decision", 0, "decided_by",
	"decided_at", "packet_hash", "created_at"
FROM "analysis_run_review";
--> statement-breakpoint
UPDATE "analysis_run_review" AS review
SET "effective_event_id" = event."id"
FROM "analysis_run_review_event" AS event
WHERE event."analysis_run_id" = review."analysis_run_id"
	AND event."sequence" = 1;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_review_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'analysis_run_review_event is append-only';
END;
$$;
CREATE TRIGGER analysis_run_review_event_immutable
BEFORE UPDATE OR DELETE ON "analysis_run_review_event"
FOR EACH ROW EXECUTE FUNCTION prevent_review_event_mutation();
