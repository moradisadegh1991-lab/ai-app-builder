-- Functions keep locking and follow-up statements in one transaction on both supported drivers.
CREATE FUNCTION reserve_ai_usage(p_id uuid, p_user uuid, p_run uuid, p_tokens integer,
  p_platform boolean, p_window bigint, p_week bigint) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE used_window bigint; used_week bigint; run_limit integer; run_used bigint;
BEGIN
  IF p_tokens < 1 THEN RAISE EXCEPTION 'Invalid token reservation'; END IF;
  PERFORM id FROM users WHERE id=p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_run IS NOT NULL THEN
    SELECT max_tokens INTO run_limit FROM workflow_runs WHERE id=p_run AND user_id=p_user AND status='running';
    IF run_limit IS NULL THEN RETURN false; END IF;
    SELECT coalesce(sum(tokens),0) INTO run_used FROM usage_reservations WHERE run_id=p_run AND state<>'released';
    IF run_used+p_tokens>run_limit THEN RETURN false; END IF;
  END IF;
  IF p_platform THEN
    SELECT coalesce(sum(input_tokens+output_tokens),0) INTO used_window FROM usage_records
      WHERE user_id=p_user AND used_platform_key AND created_at>=now()-interval '5 hours';
    SELECT used_window+coalesce(sum(tokens),0) INTO used_window FROM usage_reservations
      WHERE user_id=p_user AND used_platform_key AND state='held' AND created_at>=now()-interval '5 hours';
    SELECT coalesce(sum(input_tokens+output_tokens),0) INTO used_week FROM usage_records
      WHERE user_id=p_user AND used_platform_key AND created_at>=now()-interval '7 days';
    SELECT used_week+coalesce(sum(tokens),0) INTO used_week FROM usage_reservations
      WHERE user_id=p_user AND used_platform_key AND state='held' AND created_at>=now()-interval '7 days';
    IF used_window+p_tokens>p_window OR used_week+p_tokens>p_week THEN RETURN false; END IF;
  END IF;
  INSERT INTO usage_reservations(id,user_id,run_id,tokens,used_platform_key)
    VALUES(p_id,p_user,p_run,p_tokens,p_platform);
  RETURN true;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION approve_project_requirements(p_project uuid, p_spec jsonb) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM projects WHERE id=p_project FOR UPDATE;
  IF EXISTS(SELECT 1 FROM workflow_runs WHERE project_id=p_project AND status IN ('queued','running')) THEN
    RAISE EXCEPTION 'workflow_active';
  END IF;
  UPDATE projects SET spec=p_spec,name=p_spec->>'appName',spec_approved_at=now(),updated_at=now(),
    status=CASE WHEN status IN ('spec_ready','draft') THEN 'spec_approved'::project_status ELSE status END
    WHERE id=p_project;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION complete_payment(p_id uuid, p_receipt text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE payment payments%ROWTYPE;
BEGIN
  SELECT * INTO payment FROM payments WHERE id=p_id FOR UPDATE;
  IF payment.id IS NULL OR payment.status<>'pending' THEN RETURN; END IF;
  PERFORM id FROM users WHERE id=payment.user_id FOR UPDATE;
  INSERT INTO subscriptions(user_id,plan,current_period_end)
    VALUES(payment.user_id,payment.plan,now()+interval '30 days')
    ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,
      current_period_end=(CASE WHEN subscriptions.plan=excluded.plan AND subscriptions.current_period_end>now()
        THEN subscriptions.current_period_end ELSE now() END)+interval '30 days',updated_at=now();
  UPDATE payments SET status='paid',receipt=p_receipt,paid_at=now(),updated_at=now() WHERE id=p_id;
END;
$$;
