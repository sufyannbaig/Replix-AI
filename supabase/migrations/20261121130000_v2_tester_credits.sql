-- Replix 2.0: give launch testers free credits (and a plan) and put them back afterwards.
-- Admin only: run from the Lovable Cloud SQL editor. Not callable from the app.
--   select public.v2_grant_tester('owner@store.com', 100, 'pro', 'Ben''s tester list');
--   select public.v2_reset_tester('owner@store.com');
-- Billing is untouched: a tester who later subscribes gets their plan from the billing
-- webhooks as usual, which overwrites these values.

CREATE TABLE public.tester_grants (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_given INTEGER NOT NULL,
  plan_given TEXT NOT NULL,
  credits_before INTEGER,
  plan_before TEXT,
  note TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reset_at TIMESTAMPTZ
);
ALTER TABLE public.tester_grants ENABLE ROW LEVEL SECURITY; -- no policies: admin only

CREATE OR REPLACE FUNCTION public.v2_grant_tester(_email TEXT, _credits INTEGER, _plan TEXT DEFAULT 'pro', _note TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID; _c INTEGER; _p TEXT;
BEGIN
  IF _plan NOT IN ('free','starter','pro','scale') THEN RAISE EXCEPTION 'Unknown plan %', _plan; END IF;
  IF _credits < 0 OR _credits > 5000 THEN RAISE EXCEPTION 'Credits must be 0 to 5000'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(trim(_email));
  IF _uid IS NULL THEN RAISE EXCEPTION 'No account for %. Ask them to sign up first.', _email; END IF;
  SELECT credits, plan INTO _c, _p FROM user_credits WHERE user_id = _uid;
  -- Keep the first "before" values if they're granted twice.
  INSERT INTO tester_grants (user_id, credits_given, plan_given, credits_before, plan_before, note)
  VALUES (_uid, _credits, _plan, _c, _p, _note)
  ON CONFLICT (user_id) DO UPDATE SET credits_given = EXCLUDED.credits_given,
    plan_given = EXCLUDED.plan_given, note = COALESCE(EXCLUDED.note, tester_grants.note),
    granted_at = now(), reset_at = NULL,
    credits_before = CASE WHEN tester_grants.reset_at IS NULL THEN tester_grants.credits_before ELSE EXCLUDED.credits_before END,
    plan_before = CASE WHEN tester_grants.reset_at IS NULL THEN tester_grants.plan_before ELSE EXCLUDED.plan_before END;
  INSERT INTO user_credits (user_id, credits, plan) VALUES (_uid, _credits, _plan)
  ON CONFLICT (user_id) DO UPDATE SET credits = EXCLUDED.credits, plan = EXCLUDED.plan, updated_at = now();
  RETURN format('%s now has %s credits on %s', _email, _credits, _plan);
END $$;

CREATE OR REPLACE FUNCTION public.v2_reset_tester(_email TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID; _g tester_grants;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(trim(_email));
  SELECT * INTO _g FROM tester_grants WHERE user_id = _uid AND reset_at IS NULL;
  IF _g.user_id IS NULL THEN RAISE EXCEPTION 'No open tester grant for %', _email; END IF;
  UPDATE user_credits SET credits = COALESCE(_g.credits_before, 0),
    plan = COALESCE(_g.plan_before, 'free'), updated_at = now() WHERE user_id = _uid;
  UPDATE tester_grants SET reset_at = now() WHERE user_id = _uid;
  RETURN format('%s back to %s credits on %s', _email, COALESCE(_g.credits_before, 0), COALESCE(_g.plan_before, 'free'));
END $$;

REVOKE ALL ON FUNCTION public.v2_grant_tester(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v2_reset_tester(TEXT) FROM PUBLIC, anon, authenticated;
