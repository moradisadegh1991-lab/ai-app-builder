-- GitHub timestamps are observations, not billed minutes or invoices.
ALTER TABLE build_jobs ADD COLUMN run_attempt integer;
ALTER TABLE build_jobs ADD COLUMN run_started_at timestamptz;
ALTER TABLE build_jobs ADD COLUMN run_updated_at timestamptz;
ALTER TABLE build_jobs ADD COLUMN reported_elapsed_seconds bigint;
ALTER TABLE build_jobs ADD COLUMN cost_toman bigint;
ALTER TABLE build_jobs ADD COLUMN cost_source text;
ALTER TABLE build_jobs ADD COLUMN cost_recorded_at timestamptz;
