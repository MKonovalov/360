ALTER TABLE "analysis_template_version" ALTER COLUMN "future_budget" SET DEFAULT '{"maxAttempts":2,"maxToolCalls":6,"maxExecutionSeconds":300,"maxSpendUsd":2.5}'::jsonb;
UPDATE "analysis_template_version"
SET "future_budget" = jsonb_set("future_budget", '{maxToolCalls}', '6'::jsonb, false)
WHERE "future_budget"->>'maxToolCalls' = '12'
  AND "version" = (
    SELECT MAX(current_version."version")
    FROM "analysis_template_version" AS current_version
    WHERE current_version."template_id" = "analysis_template_version"."template_id"
  );
