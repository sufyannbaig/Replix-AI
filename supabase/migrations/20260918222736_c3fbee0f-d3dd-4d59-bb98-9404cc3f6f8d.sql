UPDATE public.user_credits
SET credits = 10, updated_at = now()
WHERE plan = 'free';