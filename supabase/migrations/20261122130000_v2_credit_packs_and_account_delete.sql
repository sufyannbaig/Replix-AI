-- Credit packs (one-off Stripe payments) and account deletion. Applied 2026-11-22.

-- Unused credits that were bought in packs. Plan credits are spent first, so at a renewal
-- or downgrade min(pack_credits, credits) is what's left of the packs and carries over.
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS pack_credits integer NOT NULL DEFAULT 0;

-- One row per paid Stripe Checkout session: a retried webhook can't grant a pack twice.
CREATE TABLE IF NOT EXISTS public.credit_pack_purchases (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL CHECK (credits > 0),
  amount_cents integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_pack_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "credit_pack_purchases: read own" ON public.credit_pack_purchases;
CREATE POLICY "credit_pack_purchases: read own" ON public.credit_pack_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.v2_grant_credit_pack(
  _session text, _user uuid, _credits integer, _amount_cents integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.credit_pack_purchases (session_id, user_id, credits, amount_cents)
  VALUES (_session, _user, _credits, _amount_cents)
  ON CONFLICT (session_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  PERFORM set_config('replix.credit_reason', 'pack', true);
  INSERT INTO public.user_credits (user_id, credits, plan, pack_credits, updated_at)
  VALUES (_user, _credits, 'free', _credits, now())
  ON CONFLICT (user_id) DO UPDATE
    SET credits = public.user_credits.credits + EXCLUDED.credits,
        pack_credits = public.user_credits.pack_credits + EXCLUDED.credits,
        updated_at = now();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_grant_credit_pack(text, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;

-- Account deletion: the rows that don't cascade from auth.users. The server then removes
-- the user's files and deletes the auth user, which cascades everything else.
CREATE OR REPLACE FUNCTION public.v2_delete_account_rows(_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.store_brands WHERE user_id = _user;
  DELETE FROM public.collections WHERE user_id = _user;
  DELETE FROM public.shopify_installations WHERE user_id = _user;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_delete_account_rows(uuid) FROM PUBLIC, anon, authenticated;
