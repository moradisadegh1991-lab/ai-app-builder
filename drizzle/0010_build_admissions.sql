CREATE TABLE build_admissions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  trigger text NOT NULL CHECK (trigger IN ('push','dispatch')),
  created_at timestamptz NOT NULL DEFAULT now(),
  build_job_id uuid REFERENCES build_jobs(id) ON DELETE SET NULL
);
CREATE INDEX build_admissions_user_created_idx ON build_admissions(user_id,created_at);
--> statement-breakpoint
CREATE FUNCTION admit_free_build(p_id uuid,p_user uuid,p_project uuid,p_trigger text,p_limit integer)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE used bigint;
BEGIN
 IF p_limit IS NULL OR p_limit < 0 OR p_trigger NOT IN ('push','dispatch') THEN RETURN false; END IF;
 PERFORM id FROM users WHERE id=p_user FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM projects WHERE id=p_project AND user_id=p_user) THEN RETURN false; END IF;
 SELECT (SELECT count(*) FROM build_admissions WHERE user_id=p_user AND created_at>=now()-interval '30 days') +
        (SELECT count(*) FROM build_jobs b JOIN projects p ON p.id=b.project_id
         WHERE p.user_id=p_user AND p.template <> 'web' AND b.created_at>=now()-interval '30 days'
           AND NOT EXISTS (SELECT 1 FROM build_admissions a WHERE a.build_job_id=b.id)) INTO used;
 IF used>=p_limit THEN RETURN false; END IF;
 INSERT INTO build_admissions(id,user_id,project_id,trigger) VALUES(p_id,p_user,p_project,p_trigger);
 RETURN true;
END;
$$;
