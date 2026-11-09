CREATE TABLE activation_requests (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('PRO_TIER', 'ENTERPRISE_TIER')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE facility_deployments (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('PRO_TIER', 'ENTERPRISE_TIER')),
  project_id UUID NOT NULL,
  environment_id UUID NOT NULL,
  app_service_id UUID NOT NULL,
  database_service_id UUID NOT NULL,
  app_origin TEXT NOT NULL UNIQUE,
  jwt_secret_hash TEXT NOT NULL UNIQUE,
  bootstrap_secret_hash TEXT NOT NULL UNIQUE,
  database_password_hash TEXT NOT NULL UNIQUE,
  bootstrap_cipher TEXT,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, app_service_id),
  UNIQUE (project_id, database_service_id),
  CHECK (app_service_id <> database_service_id)
);
