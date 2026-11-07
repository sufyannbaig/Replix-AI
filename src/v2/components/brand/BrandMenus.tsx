import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { composerChip } from "@/v2/components/studio/ComposerBar";
import { useBrandKits, useSetProductBrand, useSetStoreBrand, useStoreBrand } from "@/v2/data/api";
import { brandForProduct, brandLogo, type BrandKit, type Product } from "@/v2/data/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Saved brands only (not the "new" placeholder the page uses while adding one). */
function useSavedKits() {
  const { data: kits = [] } = useBrandKits();
  return useMemo(() => kits.filter((k) => k.id !== "new"), [kits]);
}

function BrandMark({ kit, size = 16 }: { kit: BrandKit; size?: number }) {
  const logo = brandLogo(kit);
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-black/[0.08] bg-white"
      style={{ width: size, height: size }}
    >
      {logo ? (
        <img src={logo} alt="" className="max-h-[80%] max-w-[80%] object-contain" />
      ) : (
        <span className="size-full" style={{ background: kit.colors[0] ?? "#12213d" }} />
      )}
    </span>
  );
}

/** "acme.myshopify.com" -> "acme". */
export function storeName(shop: string) {
  return shop.replace(/\.myshopify\.com$/i, "") || "your store";
}

/** Toast after a store's brand changes. */
function storeBrandToast(kits: BrandKit[], store: string, brandKitId: string | null) {
  const next = brandKitId ? kits.find((k) => k.id === brandKitId) : undefined;
  toast.success(`Products from ${store} now use ${next ? next.name : "your default brand"}`);
}

/**
 * Brand chip on a product card. Products carry their brand; ads for the product use it
 * unless the studio switches it for one generation. Shopify products take their store's
 * brand, so changing it there changes every product from that store.
 */
export function ProductBrandChip({ product }: { product: Product }) {
  const kits = useSavedKits();
  const setBrand = useSetProductBrand();
  const setStoreBrand = useSetStoreBrand();
  if (!kits.length) return null;
  const kit = brandForProduct(kits, product);
  if (!kit) return null;
  const own = !!product.brandKitId && kits.some((k) => k.id === product.brandKitId);
  const label = (
    <>
      <BrandMark kit={kit} />
      <span className="truncate">{kit.name}</span>
    </>
  );
  const chipClass =
    "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-v2-chip px-2 font-inter-tight text-xs text-v2-ink-70";

  const shopify = product.source === "shopify";
  const store = storeName(product.shopDomain ?? "");

  const chooseForStore = (brandKitId: string | null) =>
    setStoreBrand.mutate(
      { shop: product.shopDomain ?? "", brandKitId },
      {
        onSuccess: () => storeBrandToast(kits, store, brandKitId),
        onError: (e) => toast.error(e.message),
      },
    );

  const choose = (brandKitId: string | null) =>
    shopify
      ? chooseForStore(brandKitId)
      : setBrand.mutate(
          { productId: product.id, brandKitId },
          {
            onSuccess: () => {
              const next = brandKitId ? kits.find((k) => k.id === brandKitId) : undefined;
              toast.success(
                next
                  ? `${product.name} now uses ${next.name}`
                  : `${product.name} now uses your default brand`,
              );
            },
            onError: (e) => toast.error(e.message),
          },
        );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Brand for ${product.name}: ${kit.name}. Change brand`}
        className={cn(chipClass, "hover:text-v2-ink")}
      >
        {label}
        <ChevronDown className="size-3 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuLabel className="font-inter-tight text-xs font-normal text-v2-ink-60">
          {shopify ? `Ads for every product from ${store} use` : "Ads for this product use"}
        </DropdownMenuLabel>
        {kits.map((k) => (
          <DropdownMenuItem key={k.id} onSelect={() => choose(k.id)}>
            <Check className={cn("size-4", own && k.id === kit.id ? "opacity-100" : "opacity-0")} />
            <BrandMark kit={k} />
            <span className="truncate">{k.name}</span>
          </DropdownMenuItem>
        ))}
        {kits.length > 1 ? (
          <DropdownMenuItem onSelect={() => choose(null)}>
            <Check className={cn("size-4", own ? "opacity-0" : "opacity-100")} />
            Default brand
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/brand-kit">
            <Settings2 className="size-4" />
            Manage brands
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Which brand a connected Shopify store uses (connect page). With 2+ brands and nothing
 * chosen yet it asks once; afterwards it shows the brand with a menu to change it. With one
 * brand there's nothing to choose, so it shows nothing.
 */
export function StoreBrandPicker({ shop }: { shop: string }) {
  const kits = useSavedKits();
  const { data: current, isPending } = useStoreBrand(shop);
  const setStoreBrand = useSetStoreBrand();
  if (kits.length < 2 || isPending || !current) return null;
  const store = storeName(shop);
  const kit = brandForProduct(kits, { brandKitId: current.brandKitId });
  const choose = (brandKitId: string | null) =>
    setStoreBrand.mutate(
      { shop, brandKitId },
      {
        onSuccess: () => storeBrandToast(kits, store, brandKitId),
        onError: (e) => toast.error(e.message),
      },
    );

  if (!current.set) {
    return (
      <div className="flex w-full flex-col gap-3 rounded-[12px] border border-v2-line p-4">
        <div className="flex flex-col gap-1">
          <p className="font-archivo text-sm font-medium text-v2-ink">Which brand is {store}?</p>
          <p className="font-inter-tight text-xs text-v2-ink-70">
            Ads for its products use this brand&rsquo;s logo, colours and fonts. You can change it
            later.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {kits.map((k) => (
            <button
              key={k.id}
              type="button"
              disabled={setStoreBrand.isPending}
              onClick={() => choose(k.id)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[rgba(11,15,25,0.2)] px-3 font-inter-tight text-sm text-v2-ink transition-colors hover:border-v2-blue disabled:opacity-50 night:border-v2-border"
            >
              <BrandMark kit={k} />
              <span className="max-w-[160px] truncate">{k.name}</span>
              {k.isDefault ? <span className="text-xs text-v2-ink-60">Default</span> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!kit) return null;
  return (
    <div className="flex w-full items-center justify-between gap-3 font-inter-tight text-xs text-v2-ink-70">
      <span>Ads for products from {store} use</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Brand for ${store}: ${kit.name}. Change brand`}
          className="inline-flex h-7 max-w-[60%] items-center gap-1.5 rounded-full bg-v2-chip px-2 text-xs text-v2-ink-70 hover:text-v2-ink"
        >
          <BrandMark kit={kit} />
          <span className="truncate">{kit.name}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          {kits.map((k) => (
            <DropdownMenuItem key={k.id} onSelect={() => choose(k.id)}>
              <Check
                className={cn("size-4", current.brandKitId === k.id ? "opacity-100" : "opacity-0")}
              />
              <BrandMark kit={k} />
              <span className="truncate">{k.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => choose(null)}>
            <Check className={cn("size-4", current.brandKitId ? "opacity-0" : "opacity-100")} />
            Default brand
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/brand-kit">
              <Settings2 className="size-4" />
              Manage brands
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * The brand a studio generation uses: the product's brand until the user switches it, and
 * whether to show the logo (on by default). Switching resets when the product changes.
 */
export function useStudioBrand(product: Product | null) {
  const kits = useSavedKits();
  const [picked, setPicked] = useState<string | null>(null);
  const [showLogo, setShowLogo] = useState(true);
  const productId = product?.id;
  useEffect(() => setPicked(null), [productId]);
  const kit = (picked && kits.find((k) => k.id === picked)) || brandForProduct(kits, product);
  const hasLogo = !!kit && !!brandLogo(kit);
  return {
    kits,
    kit,
    pick: setPicked,
    showLogo: hasLogo && showLogo,
    setShowLogo,
    /** Fields for the GenerationRequest. Sample brands (non-uuid ids) are not sent. */
    request: kit
      ? {
          ...(UUID.test(kit.id) ? { brandKitId: kit.id } : {}),
          showLogo: hasLogo && showLogo,
        }
      : {},
  };
}

/** Composer chip: which brand this generation uses, and the "Show logo" switch. */
export function StudioBrandChip({
  brand,
  logoSwitch = true,
}: {
  brand: ReturnType<typeof useStudioBrand>;
  /** Ads draw the logo; studios without type pass false. */
  logoSwitch?: boolean;
}) {
  const { kits, kit } = brand;
  if (!kit) {
    return (
      <Link to="/brand-kit" className={cn(composerChip, "px-[13px] py-2.5")}>
        Add your brand
      </Link>
    );
  }
  const hasLogo = !!brandLogo(kit);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Brand: ${kit.name}${logoSwitch && hasLogo ? (brand.showLogo ? ", logo on" : ", logo off") : ""}`}
        className={cn(composerChip, "max-w-[190px] gap-2 py-1.5 pl-1.5 pr-[13px]")}
      >
        <BrandMark kit={kit} size={22} />
        <span className="truncate">{kit.name}</span>
        {logoSwitch && hasLogo && !brand.showLogo ? (
          <span className="shrink-0 text-black/50 night:text-v2-ink-60">· no logo</span>
        ) : null}
        <ChevronDown className="size-3 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuLabel className="font-inter-tight text-xs font-normal text-v2-ink-60">
          Brand for this generation
        </DropdownMenuLabel>
        {kits.map((k) => (
          <DropdownMenuItem key={k.id} onSelect={() => brand.pick(k.id)}>
            <Check className={cn("size-4", k.id === kit.id ? "opacity-100" : "opacity-0")} />
            <BrandMark kit={k} />
            <span className="truncate">{k.name}</span>
          </DropdownMenuItem>
        ))}
        {logoSwitch && hasLogo ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={brand.showLogo}
              onCheckedChange={(on) => brand.setShowLogo(on === true)}
              onSelect={(e) => e.preventDefault()}
            >
              Show logo
            </DropdownMenuCheckboxItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/brand-kit">
            <Settings2 className="size-4" />
            Manage brands
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
