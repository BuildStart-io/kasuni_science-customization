-- ============================================================================
-- 03_cron.sql — scheduled jobs for kasuni_science (safety net + follow-ups).
-- Tenant-isolated job names and suffixed function endpoints.
-- Requires pg_cron + pg_net. Run as superuser on your self-hosted Postgres.
--
-- Replace:
--   <FUNCTIONS_URL>  e.g. http://api-gw:8000/functions/v1   (inside docker)
--   <SERVICE_ROLE_KEY>
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-message-queue-kasuni_science') THEN
    PERFORM cron.unschedule('drain-message-queue-kasuni_science');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-followups-kasuni_science') THEN
    PERFORM cron.unschedule('send-followups-kasuni_science');
  END IF;
END $$;

-- Queue drainer safety net for kasuni_science. webhook-wsender-kasuni_science already fires
-- process-message-kasuni_science immediately on each inbound message; this catches anything left behind.
SELECT cron.schedule(
  'drain-message-queue-kasuni_science',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := '<FUNCTIONS_URL>/process-message-kasuni_science',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body    := '{"trigger":"cron"}'::jsonb
  );
  $$
);

-- Order follow-ups + inactivity follow-ups for kasuni_science.
SELECT cron.schedule(
  'send-followups-kasuni_science',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := '<FUNCTIONS_URL>/send-followups-kasuni_science',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Inspect:  SELECT jobid, jobname, schedule FROM cron.job WHERE jobname LIKE '%kasuni_science%';
-- Remove:   SELECT cron.unschedule('drain-message-queue-kasuni_science');
