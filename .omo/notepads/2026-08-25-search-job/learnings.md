# Learnings

- Task 5 terminal reconciliation must process a succeeded packet while the local run is still `running`; `recordSearchTerminalResult` is the final status transition, not the processing claim.
- With Neon HTTP-compatible single statements, `search_run.packet_hash` is the durable packet claim and a non-null `terminal_result_summary` is the completion marker. Retries may resume a claimed packet, identical completed packets replay, and a different hash conflicts before candidate writes.
- Candidate persistence failures leave the run nonterminal and the claimed packet resumable, so a later reconciliation can complete idempotently without falsely reporting success.
