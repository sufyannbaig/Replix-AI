
CREATE TABLE public.usage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  model text,
  variant_count integer NOT NULL DEFAULT 1,
  estimated_cost_usd numeric(10,5) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX usage_events_user_month_idx
  ON public.usage_events (user_id, created_at DESC);

GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own usage" ON public.usage_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
