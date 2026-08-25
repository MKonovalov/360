ALTER TABLE "search_run" ADD COLUMN "buyer_role_evidence_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "search_run" ALTER COLUMN "buyer_role_evidence_snapshot" DROP DEFAULT;
