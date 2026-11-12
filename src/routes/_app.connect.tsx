import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { normalizeShopDomain } from "@/components/ShopifyStoreConnect";
import { getShopifyProducts } from "@/lib/shopify.functions";
import { linkShopifyInstall, unlinkShopifyInstall } from "@/lib/shopify-billing.functions";
import { StoreBrandPicker } from "@/v2/components/brand/BrandMenus";
import { AppShell } from "@/v2/components/shell/AppShell";
import { PillButton } from "@/v2/components/primitives";
import shopifyBag from "@/assets/v2/icons/shopify-bag.svg";

export const Route = createFileRoute("/_app/connect")({
  head: () => ({ meta: [{ title: "Connect Shopify · Replix AI" }] }),
  component: ConnectPage,
});

const SHOPIFY_INSTALL_HOST = "https://replixai.co.uk";

/**
 * Connect Shopify (Figma 543:35881). The UI is new; the behaviour is the existing v1 flow:
 * link an existing installation, or send the merchant to Shopify's install approval.
 */
function ConnectPage() {
  const loadProducts = useServerFn(getShopifyProducts);
  const linkInstall = useServerFn(linkShopifyInstall);
  const unlinkInstall = useServerFn(unlinkShopifyInstall);
  const [shopInput, setShopInput] = useState("");
  const [busy, setBusy] = useState<"link" | "unlink" | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  const status = useQuery({
    queryKey: ["shopify-products", "connect"],
    queryFn: async () => {
      const result = await loadProducts({ data: { first: 50 } });
      setSyncedAt(Date.now());
      return result;
    },
    staleTime: 60 * 1000,
    retry: false,
  });

  const shop = useMemo(() => normalizeShopDomain(shopInput), [shopInput]);
  const connectedShop = status.data && !status.data.notInstalled ? status.data.shop : null;
  const productCount = status.data?.products.length ?? 0;

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    if (!shop) {
      toast.error("Enter your Shopify store domain");
      return;
    }
    setBusy("link");
    try {
      await linkInstall({ data: { shop } });
      toast.success("Shopify store connected");
      await status.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect store";
      if (/no installation found|not installed/i.test(message)) {
        toast.message("Redirecting to Shopify to approve installation…");
        const url = `${SHOPIFY_INSTALL_HOST}/api/public/shopify/install?shop=${encodeURIComponent(shop)}`;
        try {
          window.top!.location.href = url;
        } catch {
          window.location.href = url;
        }
        return;
      }
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("unlink");
    try {
      await unlinkInstall();
      toast.success("Store disconnected");
      await status.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't disconnect the store");
    } finally {
      setBusy(null);
    }
  };

  const minutesAgo = syncedAt ? Math.max(0, Math.round((Date.now() - syncedAt) / 60000)) : null;

  return (
    <AppShell title="Connect" subtitle="Bring your Shopify catalogue into Replix">
      <section className="mt-[66px] flex min-h-[495px] flex-col items-center justify-center rounded-[18px] bg-v2-surface px-6 py-12 shadow-[0_0_44.2px_rgba(0,0,0,0.03)] lg:mx-auto lg:w-[720px]">
        <div className="flex w-full max-w-[467px] flex-col items-center gap-[18px]">
          <div className="flex w-full flex-col items-center gap-[22px]">
            <div className="flex flex-col items-center gap-[23px] text-center">
              <span className="flex size-20 items-center justify-center rounded-[14px] bg-white drop-shadow-[0_1.75px_8.5px_rgba(0,0,0,0.06)]">
                <img src={shopifyBag} alt="" className="h-[46.4px] w-[40.6px]" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="type-section-title text-v2-ink">Connect your Shopify store</h2>
                <p className="type-subtitle text-v2-ink-70">
                  Import all your products in one go and keep them in sync.
                </p>
              </div>
            </div>
            {connectedShop ? null : (
              <form onSubmit={connect} className="flex w-full gap-2.5">
                <input
                  value={shopInput}
                  onChange={(e) => setShopInput(e.target.value)}
                  placeholder="your-store.myshopify.com"
                  aria-label="Shopify store domain"
                  autoCapitalize="none"
                  className="h-[42px] min-w-0 flex-1 rounded-[250px] border border-[rgba(11,15,25,0.3)] bg-transparent px-4 font-inter-tight text-sm tracking-[0.14px] text-v2-ink outline-none placeholder:text-[rgba(22,37,68,0.6)] focus:border-v2-blue night:border-v2-border night:placeholder:text-v2-ink-60"
                />
                <PillButton type="submit" disabled={busy !== null} className="h-[42px]">
                  {busy === "link" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Connect
                </PillButton>
              </form>
            )}
          </div>

          {status.isLoading ? (
            <p className="font-inter-tight text-xs text-v2-muted">
              Checking your store connection…
            </p>
          ) : connectedShop ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[6px] bg-[#f5f5f5] px-[18px] py-[11px] night:bg-v2-surface-2">
              <div className="flex items-center gap-[13px]">
                <span className="flex size-[52px] items-center justify-center rounded-[9px] bg-white">
                  <img src={shopifyBag} alt="" className="h-7 w-6" />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="font-archivo text-[13px] font-medium tracking-[-0.52px] text-v2-ink">
                    Connected: {connectedShop.replace(/\.myshopify\.com$/, "")} · {productCount}{" "}
                    products
                  </p>
                  <p className="font-inter-tight text-[10px] leading-[1.41] text-v2-ink-70">
                    {minutesAgo === null
                      ? "Synced"
                      : minutesAgo < 1
                        ? "Last sync just now"
                        : `Last sync ${minutesAgo} min ago`}
                  </p>
                </div>
              </div>
              <PillButton
                variant="outline"
                className="px-4 py-2 text-sm opacity-60 hover:opacity-100"
                disabled={busy !== null}
                onClick={disconnect}
              >
                {busy === "unlink" ? <Loader2 className="size-4 animate-spin" /> : null}
                Disconnect
              </PillButton>
            </div>
          ) : null}
          {connectedShop ? <StoreBrandPicker shop={connectedShop} /> : null}
        </div>
      </section>
    </AppShell>
  );
}
