import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link2, Loader2, PackageOpen, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AdCard, type AdRecord } from "@/components/AdCard";
import { ProductCardBody, productCardClasses } from "@/components/ProductCard";
import { ReferralCard } from "@/components/ReferralCard";
import { ShopifyStoreConnect } from "@/components/ShopifyStoreConnect";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice } from "@/lib/shopify";
import { getShopifyProducts } from "@/lib/shopify.functions";
import { setProductIntake } from "@/lib/product-intake";
import { fileToDataUrl } from "@/lib/image-utils";
import replixMark from "@/assets/replix-mark.png";
import shopifyMark from "@/assets/shopify-mark.png";
import productUrlIcon from "@/assets/product-url-icon.png";
import uploadProductExample from "@/assets/product-speaker.jpg";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const RECENT_SELECT =
  "id, title, hook, caption, cta, platform, image_url, image_path, style, favorite, product_id, created_at";

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loadProducts = useServerFn(getShopifyProducts);
  const [url, setUrl] = useState("");
  const [ads, setAds] = useState<AdRecord[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["shopify-products", "dashboard"],
    queryFn: () => loadProducts({ data: { first: 8 } }),
    staleTime: 60 * 1000,
  });

  const products = data?.products ?? [];
  const connected = !data?.notInstalled && products.length > 0;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void supabase
      .from("ads")
      .select(RECENT_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data: rows }) => {
        if (!cancelled) setAds((rows ?? []) as AdRecord[]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const analyzeUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("Enter a product URL first.");
      return;
    }
    try {
      new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
      toast.error("That's not a valid URL.");
      return;
    }
    setProductIntake({ kind: "url", url: trimmed });
    navigate({ to: "/create" });
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setProductIntake({
        kind: "upload",
        name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        dataUrl,
      });
      navigate({ to: "/create" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't read that image file.");
    }
  };

  return (
    <AppShell
      title="Generate AI Ads that stop the scroll. In seconds."
      subtitle="Pick a product, upload an image, or paste a product link to get started."
      titleGradient
    >
      <div className="space-y-9">
        {isLoading ? (
          <section className="flex items-center gap-2 rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground shadow-soft">
            <Loader2 className="size-4 animate-spin" /> Loading your Shopify products…
          </section>
        ) : connected ? (
          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-medium">Promote Best Sellers</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select your Shopify product and generate ads.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="rounded-full">
                <Link to="/create">View all</Link>
              </Button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {products.slice(0, 4).map(({ node: p }, index) => {
                const image = p.images.edges[0]?.node;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProductIntake({ kind: "shopify", handle: p.handle });
                      void navigate({ to: "/create" });
                    }}
                    className={productCardClasses(false, "w-full")}
                  >
                    <ProductCardBody
                      image={image?.url}
                      imageAlt={image?.altText ?? p.title}
                      name={p.title}
                      price={formatPrice(
                        p.priceRange.minVariantPrice.amount,
                        p.priceRange.minVariantPrice.currencyCode,
                      )}
                      badge={index < 3 ? `#${index + 1} Best Seller` : undefined}
                      fallback={<PackageOpen className="size-8" />}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="space-y-5">
            <div className="relative overflow-hidden rounded-3xl bg-shopify-green px-6 py-12 text-center text-navy-foreground shadow-soft sm:px-12">
              <span className="pointer-events-none absolute -right-16 -top-20 z-0 h-64 w-64 rounded-full bg-white/15 backdrop-blur-sm" />
              <span className="pointer-events-none absolute -bottom-24 -left-10 z-0 h-56 w-56 rounded-full bg-white/10 backdrop-blur-sm" />
              <span className="pointer-events-none absolute -bottom-16 right-1/3 z-0 h-40 w-40 rounded-full bg-white/10 backdrop-blur-sm" />
              <div className="relative z-10 mx-auto flex w-fit items-center gap-3 sm:gap-4">
                <img
                  src={shopifyMark}
                  alt="Shopify"
                  className="h-16 w-16 -rotate-6 rounded-2xl shadow-lift sm:h-20 sm:w-20"
                />
                <span className="flex items-center gap-1.5">
                  <span className="h-px w-6 bg-white/70 sm:w-10" />
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 shadow-lift backdrop-blur-sm">
                    <Link2 className="h-4 w-4" />
                  </span>
                  <span className="h-px w-6 bg-white/70 sm:w-10" />
                </span>
                <img
                  src={replixMark}
                  alt="Replix AI"
                  className="h-16 w-16 rotate-6 rounded-2xl shadow-lift sm:h-20 sm:w-20"
                />
              </div>
              <h2 className="relative z-10 mt-5 text-2xl font-medium sm:text-3xl">
                Connect Your <span className="font-bold italic">Shopify</span> Store
              </h2>
              <p className="relative z-10 mx-auto mt-3 max-w-md text-sm text-navy-foreground/85">
                Sync your Shopify catalog and create studio-quality ads with optimized copy in
                under 60 seconds.
              </p>
            </div>
            <ShopifyStoreConnect onConnected={() => refetch()} />

          </section>
        )}

        <div className="flex items-center gap-5">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted-foreground">OR</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col items-center rounded-3xl border border-border bg-card px-8 py-10 text-center shadow-soft">
            <img
              src={uploadProductExample}
              alt="Product upload example"
              className="h-24 w-24 -rotate-6 rounded-2xl border-4 border-secondary object-cover shadow-soft"
            />
            <h2 className="mt-6 font-display text-xl font-semibold">Upload Product Image</h2>
            <p className="mt-2 text-sm text-muted-foreground">Use JPG, PNG, or WEBP (max 10 MB).</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files?.[0])}
            />
            <Button
              variant="outline"
              className="mt-6 rounded-full px-6"
              onClick={() => inputRef.current?.click()}
            >
              <Upload /> Upload Image
            </Button>
          </div>

          <div className="flex flex-col items-center rounded-3xl border border-border bg-card px-8 py-10 text-center shadow-soft">
            <img
              src={productUrlIcon}
              alt="Product URL"
              className="h-16 w-16 rounded-2xl object-contain"
            />

            <h2 className="mt-6 font-display text-xl font-semibold">Enter Your Product URL</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Works with any Shopify product page.
            </p>
            <div className="mt-6 flex w-full max-w-md rounded-full border border-input bg-background p-1.5 pl-4">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") analyzeUrl();
                }}
                placeholder="https://yourstore.com/products/..."
                className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <Button className="rounded-full" onClick={analyzeUrl}>
                Analyze
              </Button>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-medium">Recent Generated Ads</h2>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/gallery">View All</Link>
            </Button>
          </div>
          {ads.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
              <Sparkles className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No ads yet.</p>
              <Button asChild className="mt-5 rounded-full">
                <Link to="/create">Generate your first ad</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ads.map((ad) => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  compact
                  onChange={(next) =>
                    setAds((prev) => prev.map((a) => (a.id === next.id ? next : a)))
                  }
                />
              ))}
            </div>
          )}
        </section>

        <ReferralCard />
      </div>

    </AppShell>
  );
}
