DELETE FROM "search_candidate_audit" duplicate
USING "search_candidate_audit" keeper
WHERE duplicate."id" > keeper."id"
  AND duplicate."search_candidate_id" = keeper."search_candidate_id"
  AND duplicate."event_type" = keeper."event_type"
  AND duplicate."revision" = keeper."revision";--> statement-breakpoint
ALTER TABLE "search_candidate_audit" ADD CONSTRAINT "search_candidate_audit_candidate_event_revision_unique" UNIQUE("search_candidate_id","event_type","revision");
