import { useMemo, useState, type FormEvent, type MouseEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Link2, Loader2, Store } from "lucide-react";
import { toast } from "sonner";

import { linkShopifyInstall } from "@/lib/shopify-billing.functions";

const SHOPIFY_INSTALL_HOST = "https://replixai.co.uk";

type ShopifyStoreConnectProps = {
  title?: string;
  description?: string;
  defaultShop?: string;
  onConnected?: (shopDomain: string) => void;
};

export function normalizeShopDomain(input: string) {
  const trimmed = input.trim().toLowerCase();
  const withProtocol = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.hostname === "admin.shopify.com") {
      const handle = url.pathname.match(/^\/store\/([^/?#]+)/)?.[1];
      return handle ? `${handle}.myshopify.com` : "";
    }
  } catch {
    // Fall back to simple domain/handle parsing below.
  }
  const raw = trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!raw) return "";
  return raw.endsWith(".myshopify.com") ? raw : `${raw}.myshopify.com`;
}

export function ShopifyStoreConnect({
  title = "Connect your Shopify store",
  description = "Enter your Shopify store domain to link an existing Replix installation to this account, or install Replix on the store first.",
  defaultShop = "",
  onConnected,
}: ShopifyStoreConnectProps) {
  const linkInstall = useServerFn(linkShopifyInstall);
  const [shopInput, setShopInput] = useState(defaultShop);
  const [linking, setLinking] = useState(false);
  const [installPromptUrl, setInstallPromptUrl] = useState<string | null>(null);

  const normalizedShop = useMemo(() => normalizeShopDomain(shopInput), [shopInput]);
  const installUrl = normalizedShop
    ? `${SHOPIFY_INSTALL_HOST}/api/public/shopify/install?shop=${encodeURIComponent(normalizedShop)}`
    : "";

  const showInstallInstructions = () => {
    if (!normalizedShop || !installUrl) {
      toast.error("Enter your Shopify store domain");
      return;
    }

    setInstallPromptUrl(installUrl);
    toast.message("Copy the Shopify install link", {
      description: "Open it in your browser address bar, not inside the preview.",
    });
  };

  const copyInstallUrl = async () => {
    if (!installPromptUrl) return;
    await navigator.clipboard.writeText(installPromptUrl);
    toast.success("Shopify install link copied");
  };

  const handleLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!normalizedShop) {
      toast.error("Enter your Shopify store domain");
      return;
    }
    setInstallPromptUrl(null);

    setLinking(true);
    try {
      const result = await linkInstall({ data: { shop: normalizedShop } });
      const shopDomain = result.shop_domain ?? normalizedShop;
      toast.success("Shopify store connected");
      onConnected?.(shopDomain);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect store";
      // If Replix isn't installed on this store yet, send the merchant straight
      // to Shopify's OAuth approval screen. After they click Install, Shopify
      // redirects to our callback which writes the installation row and links
      // it to this user automatically.
      if (/no installation found/i.test(message) || /not installed/i.test(message)) {
        toast.message("Redirecting to Shopify to approve installation…");
        try {
          window.top!.location.href = installUrl;
        } catch {
          window.location.href = installUrl;
        }
        return;
      }
      toast.error(message);
    } finally {
      setLinking(false);
    }
  };

  const handleInstallClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!normalizedShop) {
      toast.error("Enter your Shopify store domain");
      return;
    }
    showInstallInstructions();
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold-soft text-navy">
          <Store className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>

          <form onSubmit={handleLink} className="mt-5 space-y-3">
            <label
              htmlFor="shopify-store-domain"
              className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Shopify store domain
            </label>
            <div className="flex flex-col gap-3 lg:flex-row">
              <input
                id="shopify-store-domain"
                type="text"
                value={shopInput}
                onChange={(event) => setShopInput(event.target.value)}
                placeholder="your-store.myshopify.com"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-gold"
              />
              <button
                type="submit"
                disabled={linking || !normalizedShop}
                className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow hover:opacity-95 disabled:opacity-50"
              >
                {linking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Link2 className="size-4" />
                )}
                Connect store
              </button>
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={!normalizedShop}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold text-navy hover:bg-muted disabled:opacity-50"
              >
                <Store className="size-4" />
                Install on this store
                <ExternalLink className="size-3.5 opacity-70" />
              </button>
            </div>
            {installPromptUrl ? (
              <div className="space-y-2 rounded-xl border border-gold-soft bg-gold-soft/40 px-3 py-2 text-xs text-muted-foreground">
                <p>This store needs the app installed first.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={copyInstallUrl}
                    className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 font-semibold text-white shadow hover:opacity-95"
                  >
                    Copy install link
                  </button>
                  <input
                    readOnly
                    value={installPromptUrl}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-2 font-mono text-[11px] text-foreground"
                  />
                </div>
              </div>
            ) : null}
            {normalizedShop && normalizedShop !== shopInput.trim().toLowerCase() ? (
              <p className="text-xs text-muted-foreground">
                We'll use <span className="font-medium text-foreground">{normalizedShop}</span>
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}
