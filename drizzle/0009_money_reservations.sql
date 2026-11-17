ALTER TABLE usage_reservations ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE usage_reservations ADD COLUMN reserved_toman bigint;
CREATE INDEX usage_reservations_cost_idx ON usage_reservations(created_at) WHERE used_platform_key AND state <> 'released';
--> statement-breakpoint
CREATE FUNCTION reserve_ai_money(p_id uuid,p_user uuid,p_project uuid,p_run uuid,p_tokens integer,
 p_window bigint,p_week bigint,p_amount bigint,p_limits jsonb) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE lim bigint; used bigint; pair record;
BEGIN
 IF p_amount IS NULL OR p_amount < 1 OR p_limits IS NULL THEN RETURN false; END IF;
 -- One transaction lock serializes all financial admissions, including different users.
 PERFORM pg_advisory_xact_lock(19871205);
 IF p_project IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projects WHERE id=p_project AND user_id=p_user) THEN RETURN false; END IF;
 IF p_run IS NOT NULL AND NOT EXISTS (SELECT 1 FROM workflow_runs WHERE id=p_run AND user_id=p_user AND (p_project IS NULL OR project_id=p_project)) THEN RETURN false; END IF;
 -- Existing unpriced platform usage cannot be assumed to be free.
 IF EXISTS (SELECT 1 FROM usage_records u WHERE u.used_platform_key AND u.created_at >= now()-interval '30 days' AND (u.estimated_cost_toman IS NULL OR u.reservation_id IS NULL OR NOT EXISTS (SELECT 1 FROM usage_reservations x WHERE x.id=u.reservation_id AND x.reserved_toman IS NOT NULL)))
 OR EXISTS (SELECT 1 FROM usage_reservations u WHERE u.used_platform_key AND u.state='held' AND u.created_at >= now()-interval '30 days' AND u.reserved_toman IS NULL) THEN RETURN false; END IF;
 FOR pair IN SELECT * FROM (VALUES
   ('platform_day', 'day'),('platform_month','month'),('user_day','day'),('user_month','month'),
   ('project_day','day'),('project_month','month'),('run','run')) AS x(name,period)
 LOOP
   IF NOT (p_limits ? pair.name) OR (p_limits->>pair.name) !~ '^[0-9]{1,12}$' THEN RETURN false; END IF;
   lim := (p_limits->>pair.name)::bigint;
   SELECT coalesce(sum(reserved_toman),0) INTO used FROM usage_reservations u
   WHERE u.used_platform_key AND u.state<>'released' AND u.reserved_toman IS NOT NULL
     AND (CASE pair.period WHEN 'day' THEN u.created_at>=now()-interval '1 day' WHEN 'month' THEN u.created_at>=now()-interval '30 days' ELSE true END)
     AND (CASE WHEN pair.name LIKE 'user_%' THEN u.user_id=p_user
               WHEN pair.name LIKE 'project_%' THEN p_project IS NOT NULL AND u.project_id=p_project
               WHEN pair.name='run' THEN p_run IS NOT NULL AND u.run_id=p_run ELSE true END);
   IF used+p_amount>lim THEN RETURN false; END IF;
 END LOOP;
 IF NOT reserve_ai_usage(p_id,p_user,p_run,p_tokens,true,p_window,p_week) THEN RETURN false; END IF;
 UPDATE usage_reservations SET project_id=p_project,reserved_toman=p_amount WHERE id=p_id;
 RETURN true;
END;
$$;
