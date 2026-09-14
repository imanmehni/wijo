-- Supabase Schema for API Watcher

-- 1. Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Jobs / API Configs Table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'fetch' or 'curl'
  raw_request TEXT NOT NULL,
  parsed_request JSONB NOT NULL,
  timezone TEXT DEFAULT 'Asia/Tehran',
  schedule TEXT, -- e.g. '01:00 DAILY'
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Executions Table
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'MANUAL' or 'CRON'
  resolved_request JSONB NOT NULL,
  attempts JSONB NOT NULL,
  success BOOLEAN NOT NULL,
  final_status_code INTEGER,
  total_duration INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_executions_job_id ON executions(job_id);
CREATE INDEX idx_executions_created_at ON executions(created_at);

-- (Optional) Add a default project if you want
INSERT INTO projects (name) VALUES ('Default Project');
