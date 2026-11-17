-- Nullable: historic records and unsupported tariffs remain explicitly unknown.
ALTER TABLE usage_records ADD COLUMN reservation_id uuid;
ALTER TABLE usage_records ADD COLUMN run_id uuid REFERENCES workflow_runs(id) ON DELETE SET NULL;
ALTER TABLE usage_records ADD COLUMN agent_role text;
ALTER TABLE usage_records ADD COLUMN gateway text;
ALTER TABLE usage_records ADD COLUMN estimated_cost_toman bigint;
ALTER TABLE usage_records ADD COLUMN tariff_snapshot jsonb;
CREATE UNIQUE INDEX usage_records_reservation_idx ON usage_records(reservation_id);
