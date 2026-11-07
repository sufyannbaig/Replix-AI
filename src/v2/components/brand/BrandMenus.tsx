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
import { useBrandKits, useSetProductBrand } from "@/v2/data/api";
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

/**
 * Brand chip on a product card. Products carry their brand; ads for the product use it
 * unless the studio switches it for one generation. Shopify products have no row yet, so
 * they show the default brand without a menu.
 */
export function ProductBrandChip({ product }: { product: Product }) {
  const kits = useSavedKits();
  const setBrand = useSetProductBrand();
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

  if (product.source === "shopify") {
    return (
      <span className={chipClass} title="Shopify products use your default brand for now">
        {label}
      </span>
    );
  }

  const choose = (brandKitId: string | null) =>
    setBrand.mutate(
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
          Ads for this product use
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
