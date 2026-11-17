-- Drafts are explicit opt-in; existing AI-generated projects are not converted.
CREATE TABLE visual_projects (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision >= 1),
  document jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
