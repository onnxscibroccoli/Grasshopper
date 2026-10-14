CREATE TABLE IF NOT EXISTS controller_devices (
    device_id text PRIMARY KEY,
    certificate_uri text NOT NULL UNIQUE,
    certificate_sha256 char(64) NOT NULL UNIQUE,
    scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
    enabled boolean NOT NULL DEFAULT false,
    last_seen_at timestamptz,
    last_session_id text,
    last_execution_state text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT controller_devices_id_format CHECK (device_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
    CONSTRAINT controller_devices_cert_sha_format CHECK (certificate_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE TABLE IF NOT EXISTS controller_api_clients (
    certificate_sha256 char(64) PRIMARY KEY,
    principal_id text NOT NULL,
    scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
    allowed_devices text[] NOT NULL DEFAULT ARRAY[]::text[],
    enabled boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT controller_api_clients_cert_sha_format CHECK (certificate_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE TABLE IF NOT EXISTS controller_jobs (
    job_id text PRIMARY KEY,
    idempotency_key text NOT NULL UNIQUE,
    created_by text NOT NULL,
    device_id text NOT NULL REFERENCES controller_devices(device_id),
    operation text NOT NULL CHECK (operation = 'android.rish.transport.probe'),
    required_scope text NOT NULL CHECK (required_scope = 'android.rish.probe'),
    payload bytea NOT NULL DEFAULT decode('', 'hex') CHECK (octet_length(payload) = 0),
    state text NOT NULL CHECK (state IN (
        'queued', 'offered', 'accepted', 'completed', 'not_proven',
        'failed', 'indeterminate', 'cancelled'
    )),
    deadline_at timestamptz NOT NULL,
    offered_at timestamptz,
    accepted_at timestamptz,
    finished_at timestamptz,
    lease_session_id text,
    result_state text,
    result_payload bytea,
    result_sha256 char(64),
    result_detail text,
    result_acknowledged boolean NOT NULL DEFAULT false,
    last_error_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT controller_jobs_id_format CHECK (job_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
    CONSTRAINT controller_jobs_idempotency_format CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{1,128}$'),
    CONSTRAINT controller_jobs_result_sha_format CHECK (
        result_sha256 IS NULL OR result_sha256 ~ '^[a-f0-9]{64}$'
    )
);

CREATE INDEX IF NOT EXISTS controller_jobs_dispatch_queue
    ON controller_jobs (device_id, created_at)
    WHERE state = 'queued';

CREATE INDEX IF NOT EXISTS controller_jobs_session_lease
    ON controller_jobs (device_id, lease_session_id)
    WHERE state IN ('offered', 'accepted', 'indeterminate');

CREATE INDEX IF NOT EXISTS controller_jobs_result_ack
    ON controller_jobs (updated_at)
    WHERE result_payload IS NOT NULL AND result_acknowledged = false;

CREATE TABLE IF NOT EXISTS controller_audit_events (
    event_id bigserial PRIMARY KEY,
    event_type text NOT NULL,
    principal_id text,
    device_id text,
    job_id text,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS controller_audit_events_created
    ON controller_audit_events (created_at DESC);

REVOKE ALL ON controller_devices, controller_api_clients, controller_jobs, controller_audit_events FROM PUBLIC;
