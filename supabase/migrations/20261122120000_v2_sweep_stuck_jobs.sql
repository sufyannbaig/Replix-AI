-- Stuck-job sweeper (V2_AUDIT item 6). A video finishes only when its result page is polled
-- or fal's webhook arrives; if neither happens the credits stay reserved for ever. Every 15
-- minutes this settles jobs that are clearly dead and refunds what wasn't delivered, using
-- the same v2_settle_generation_job the app uses (so a delivered video still counts).
-- Limits are well past the app's own (10 min queued, 6 min running, 15 min video), so a job
-- the app can still recover is never touched. Applied 2026-11-22.

CREATE OR REPLACE FUNCTION public.v2_sweep_stuck_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _job record;
  _ok integer;
  _n integer := 0;
BEGIN
  FOR _job IN
    SELECT id, kind FROM public.generation_jobs
    WHERE (status = 'queued' AND created_at < now() - interval '30 minutes')
       OR (status = 'running' AND COALESCE(started_at, created_at) < now() -
           CASE WHEN kind = 'video' THEN interval '2 hours' ELSE interval '30 minutes' END)
  LOOP
    SELECT count(*) INTO _ok FROM public.generation_outputs o
    WHERE o.job_id = _job.id AND (_job.kind <> 'video' OR o.video_path IS NOT NULL);
    PERFORM public.v2_settle_generation_job(
      _job.id, _ok, 'This generation timed out. Your credits are back.', 0);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_sweep_stuck_jobs() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('v2-sweep-stuck-jobs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'v2-sweep-stuck-jobs');
SELECT cron.schedule('v2-sweep-stuck-jobs', '*/15 * * * *', 'SELECT public.v2_sweep_stuck_jobs()');
