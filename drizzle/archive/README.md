# Archived failed migrations

`0002_phase33_34_correction.failed.sql` is preserved as historical evidence of
the Phase 33/34 migration that failed in Production and rolled back. It is not
an active migration: the legacy Drizzle v7 journal deliberately omits its tag,
so `drizzle-kit migrate` cannot replay it. The reviewed forward repair is
`../0008_phase33_34_packet_review_forward_repair.sql`.

The archived `0002_snapshot.failed.json` is retained alongside the failed SQL
for auditability and is outside `drizzle/meta/`, where Drizzle Kit discovers
active snapshots.
