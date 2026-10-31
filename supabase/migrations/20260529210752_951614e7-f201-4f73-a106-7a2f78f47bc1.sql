
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

UPDATE public.user_credits
  SET credits = 250, plan = 'pro', updated_at = now()
  WHERE user_id = '1b7bf219-e619-453c-9bc0-2848f6ceaed7';
