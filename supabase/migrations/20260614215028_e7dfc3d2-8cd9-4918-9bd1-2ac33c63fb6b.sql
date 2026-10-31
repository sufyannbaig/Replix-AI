
-- 1) Prevent authenticated users from reading the Shopify access_token column
REVOKE SELECT ON public.shopify_installations FROM authenticated;
GRANT SELECT (id, shop_domain, scopes, user_id, installed_at, uninstalled_at, created_at, updated_at)
  ON public.shopify_installations TO authenticated;

-- 2) Atomic credit consumption with row lock
CREATE OR REPLACE FUNCTION public.consume_credits(_user_id uuid, _amount int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining int;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  SELECT credits INTO remaining
  FROM public.user_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF remaining IS NULL THEN
    RAISE EXCEPTION 'no credit row';
  END IF;

  IF remaining < _amount THEN
    RAISE EXCEPTION 'insufficient credits: % < %', remaining, _amount;
  END IF;

  UPDATE public.user_credits
  SET credits = remaining - _amount
  WHERE user_id = _user_id;

  RETURN remaining - _amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(_user_id uuid, _amount int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining int;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.user_credits
  SET credits = credits + _amount
  WHERE user_id = _user_id
  RETURNING credits INTO remaining;

  RETURN remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_credits(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_credits(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credits(uuid, int) TO service_role;
