ALTER TABLE public.shopify_installations
  ADD COLUMN refresh_token TEXT,
  ADD COLUMN access_token_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN refresh_token_expires_at TIMESTAMP WITH TIME ZONE;