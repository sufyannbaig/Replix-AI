-- Replix 2.0: thumbs up / down on each result, with an optional short reason.
-- One answer per person per output; changing it updates the row. Touches only a new v2 table.

CREATE TABLE public.output_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  output_id UUID NOT NULL REFERENCES public.generation_outputs(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.generation_jobs(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  reasons TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(reasons) <= 6),
  note TEXT CHECK (char_length(note) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, output_id)
);
CREATE INDEX output_feedback_job_idx ON public.output_feedback (job_id);
CREATE INDEX output_feedback_created_idx ON public.output_feedback (created_at DESC);

ALTER TABLE public.output_feedback ENABLE ROW LEVEL SECURITY;

-- People see and write only their own answers, and only on their own outputs.
CREATE POLICY "own feedback read" ON public.output_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own feedback insert" ON public.output_feedback
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.generation_outputs o
      WHERE o.id = output_id AND o.job_id = output_feedback.job_id AND o.user_id = auth.uid()
    )
  );
CREATE POLICY "own feedback update" ON public.output_feedback
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.output_feedback TO authenticated;
