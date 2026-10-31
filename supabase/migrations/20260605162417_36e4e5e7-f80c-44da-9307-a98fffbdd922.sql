GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
CREATE POLICY "Service role manages usage events" ON public.usage_events FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');