-- Replix 2.0, phase 1: create, settle and price generation jobs atomically.
-- All three functions are SECURITY DEFINER and callable only by the service role (server
-- functions); users can't call them from the browser.

-- What the providers charged us for this job (estimated from usage; see docs/V2_GENERATION_COSTS.md).
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS provider_cost_usd NUMERIC(10, 5);
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
-- Ad Studio copy (headline, CTA) per output, so the overlay can be edited later.
ALTER TABLE public.generation_outputs ADD COLUMN IF NOT EXISTS copy JSONB;

-- Reserve credits and create the job in one transaction. Raises 'insufficient credits' or
-- 'no credit row'; nothing is written in that case.
CREATE OR REPLACE FUNCTION public.v2_create_generation_job(
  _user_id UUID,
  _studio TEXT,
  _kind TEXT,
  _request JSONB,
  _aspect TEXT,
  _count INTEGER,
  _seconds INTEGER,
  _cost INTEGER
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _balance INTEGER;
  _job UUID;
BEGIN
  SELECT credits INTO _balance FROM public.user_credits WHERE user_id = _user_id FOR UPDATE;
  IF _balance IS NULL THEN
    RAISE EXCEPTION 'no credit row';
  END IF;
  IF _balance < _cost THEN
    RAISE EXCEPTION 'insufficient credits: % < %', _balance, _cost;
  END IF;

  INSERT INTO public.generation_jobs (user_id, studio, kind, request, aspect, count, seconds, cost)
  VALUES (_user_id, _studio, _kind, _request, _aspect, _count, _seconds, _cost)
  RETURNING id INTO _job;

  PERFORM set_config('replix.credit_reason', 'generation', true);
  PERFORM set_config('replix.credit_job', _job::text, true);
  UPDATE public.user_credits SET credits = _balance - _cost WHERE user_id = _user_id;
  RETURN _job;
END;
$$;

-- Atomically move a queued job to running. Returns false if another worker already has it.
CREATE OR REPLACE FUNCTION public.v2_claim_generation_job(_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.generation_jobs
  SET status = 'running', progress = 0.05, started_at = now()
  WHERE id = _job_id AND status = 'queued';
  RETURN FOUND;
END;
$$;

-- Finish a job: `_ok` of `count` outputs succeeded. Refunds the unused share of the cost
-- (all of it when nothing succeeded). Idempotent: does nothing once the job is settled.
CREATE OR REPLACE FUNCTION public.v2_settle_generation_job(
  _job_id UUID,
  _ok INTEGER,
  _error TEXT,
  _provider_cost_usd NUMERIC
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _job public.generation_jobs%ROWTYPE;
  _refund INTEGER;
BEGIN
  SELECT * INTO _job FROM public.generation_jobs WHERE id = _job_id FOR UPDATE;
  IF NOT FOUND OR _job.status IN ('done', 'failed') THEN
    RETURN 0;
  END IF;

  _ok := GREATEST(0, LEAST(COALESCE(_ok, 0), _job.count));
  _refund := CASE WHEN _ok = 0 THEN _job.cost
                  ELSE (_job.cost / _job.count) * (_job.count - _ok) END;

  UPDATE public.generation_jobs
  SET status = CASE WHEN _ok > 0 THEN 'done' ELSE 'failed' END,
      progress = CASE WHEN _ok > 0 THEN 1 ELSE progress END,
      error = _error,
      refunded = _refund > 0,
      provider_cost_usd = _provider_cost_usd,
      finished_at = now()
  WHERE id = _job_id;

  IF _refund > 0 THEN
    PERFORM set_config('replix.credit_reason', 'refund', true);
    PERFORM set_config('replix.credit_job', _job_id::text, true);
    UPDATE public.user_credits SET credits = credits + _refund WHERE user_id = _job.user_id;
  END IF;
  RETURN _refund;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_create_generation_job(UUID, TEXT, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v2_claim_generation_job(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v2_settle_generation_job(UUID, INTEGER, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_create_generation_job(UUID, TEXT, TEXT, JSONB, TEXT, INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.v2_claim_generation_job(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.v2_settle_generation_job(UUID, INTEGER, TEXT, NUMERIC) TO service_role;
