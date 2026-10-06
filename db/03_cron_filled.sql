-- ============================================================================
-- 03_cron.sql — scheduled jobs (safety net + follow-ups).
-- Requires pg_cron + pg_net. Run as superuser on your self-hosted Postgres.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unscheduling if previously scheduled
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('drain-message-queue', 'send-followups');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Queue drainer safety net. webhook-wsender already fires process-message-kasuni_science
-- immediately on each inbound message; this catches anything left behind.
SELECT cron.schedule(
  'drain-message-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'http://api-gw:8000/functions/v1/process-message-kasuni_science',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3OTEyMTczNjYsImV4cCI6MjEwNjU3NzM2Nn0.ZpPKbTin_mlx3ppqxLMGfcjNs1ymAh61Qx_puX9tFKs"}'::jsonb,
    body    := '{"trigger":"cron"}'::jsonb
  );
  $$
);

-- Order follow-ups + inactivity follow-ups.
SELECT cron.schedule(
  'send-followups',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'http://api-gw:8000/functions/v1/send-followups-kasuni_science',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3OTEyMTczNjYsImV4cCI6MjEwNjU3NzM2Nn0.ZpPKbTin_mlx3ppqxLMGfcjNs1ymAh61Qx_puX9tFKs"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
