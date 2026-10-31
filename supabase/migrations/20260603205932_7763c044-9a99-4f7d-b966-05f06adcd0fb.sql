
-- 1. Remove client-side credit update; credits mutate only via service_role server fns.
DROP POLICY IF EXISTS "update own credits" ON public.user_credits;

-- 2. Lock shopify_app_charges to service_role only; owners can read via join.
CREATE POLICY "Service role manages app charges"
  ON public.shopify_app_charges
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users view their own app charges"
  ON public.shopify_app_charges
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shopify_installations si
      WHERE si.id = shopify_app_charges.installation_id
        AND si.user_id = auth.uid()
    )
  );

-- 3. Lock shopify_gdpr_requests to service_role only.
CREATE POLICY "Service role manages gdpr requests"
  ON public.shopify_gdpr_requests
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. Lock shopify_installations: service_role manages, owners can read their row.
CREATE POLICY "Service role manages installations"
  ON public.shopify_installations
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users view their own installation"
  ON public.shopify_installations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 5. Scope realtime subscriptions to topics owned by the authenticated user.
--    App uses topics: credits-{user_id}-... and ads-{user_id}-...
CREATE POLICY "Users can subscribe to their own realtime topics"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE ('credits-' || auth.uid()::text || '-%')
    OR realtime.topic() LIKE ('ads-' || auth.uid()::text || '-%')
  );
