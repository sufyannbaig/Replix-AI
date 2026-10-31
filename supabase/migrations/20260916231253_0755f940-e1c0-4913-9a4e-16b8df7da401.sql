ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;