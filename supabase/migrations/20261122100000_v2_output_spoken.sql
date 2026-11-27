-- The words a UGC creator or a Concept narrator says, shown as the script and captions.
alter table public.generation_outputs
  add column if not exists spoken text
  check (spoken is null or char_length(spoken) <= 1200);
