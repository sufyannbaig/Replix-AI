-- Per-shop app installations
CREATE TABLE public.shopify_installations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_domain TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  scopes TEXT NOT NULL,
  user_id UUID,
  installed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uninstalled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_shopify_installations_user_id ON public.shopify_installations(user_id);

GRANT ALL ON public.shopify_installations TO service_role;

ALTER TABLE public.shopify_installations ENABLE ROW LEVEL SECURITY;

-- No public/auth policies — only the service role (webhooks + server functions) touches this table.

-- Shopify Billing API recurring charges
CREATE TABLE public.shopify_app_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_id UUID NOT NULL REFERENCES public.shopify_installations(id) ON DELETE CASCADE,
  shopify_charge_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  price_amount NUMERIC(10, 2) NOT NULL,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  activated_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  confirmation_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (installation_id, shopify_charge_id)
);

GRANT ALL ON public.shopify_app_charges TO service_role;

ALTER TABLE public.shopify_app_charges ENABLE ROW LEVEL SECURITY;

-- GDPR webhook audit log (Shopify mandatory webhooks)
CREATE TABLE public.shopify_gdpr_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  shop_domain TEXT NOT NULL,
  shop_id BIGINT,
  customer_id BIGINT,
  customer_email TEXT,
  payload JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_shopify_gdpr_requests_shop ON public.shopify_gdpr_requests(shop_domain);

GRANT ALL ON public.shopify_gdpr_requests TO service_role;

ALTER TABLE public.shopify_gdpr_requests ENABLE ROW LEVEL SECURITY;
