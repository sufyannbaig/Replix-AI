import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useGenerate } from "@/v2/components/studio/useGenerate";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { SectionTitle } from "@/v2/components/primitives";
import { ComposerBar, missingHint, TemplateChip } from "@/v2/components/studio/ComposerBar";
import { StudioBrandChip, useStudioBrand } from "@/v2/components/brand/BrandMenus";
import { ProductPicker } from "@/v2/components/studio/ProductPicker";
import { StudioSteps } from "@/v2/components/studio/StudioSteps";
import { adGenerationCost, useAdThemes, useProductInsights } from "@/v2/data/api";
import type { AdTheme, AspectRatio, Product } from "@/v2/data/types";
import plusJoin from "@/assets/v2/icons/plus-join.svg";
import artMocha from "@/assets/v2/catalog/product/acme-linen-shirt.webp";
import artSodaHand from "@/assets/v2/catalog/ad/testimonial.webp";
import artSodaCherry from "@/assets/v2/catalog/product/acme-charge.webp";
import artTruffle from "@/assets/v2/catalog/product/acme-glow-serum.webp";

export const Route = createFileRoute("/_app/ad-studio")({
  head: () => ({ meta: [{ title: "Ad Studio · Replix AI" }] }),
  component: AdStudioPage,
});

function AdStudioPage() {
  const { generate, pending: generating } = useGenerate();
  const [product, setProduct] = useState<Product | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [theme, setTheme] = useState<AdTheme | null>(null);
  const [aspect, setAspect] = useState<AspectRatio>("1:1");
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  const insights = useProductInsights(product);
  const { data: themes = [] } = useAdThemes();
  const brand = useStudioBrand(product);

  return (
    <AppShell title="Ad Studio" subtitle="Turn one product into ready-to-run ad creatives">
      <div className="mt-10 flex flex-col gap-10 pb-[250px] sm:pb-[160px]">
        <StudioSteps
          steps={[
            { label: "Add your product", done: !!product, onClick: () => setPickerOpen(true) },
            { label: "Pick a creative theme", done: !!theme },
            { label: "Generate", done: false },
          ]}
        />

        <section className="relative grid gap-5 lg:grid-cols-[454fr_512fr] lg:gap-[74px]">
          {product ? (
            <ProductCard
              product={product}
              onChange={() => setPickerOpen(true)}
              onDelete={() => {
                setProduct(null);
                setTheme(null);
              }}
            />
          ) : (
            <AddProductCard onClick={() => setPickerOpen(true)} />
          )}

          {/* 34px circle inside a 68px SVG with shadow; centred in the 74px column gap. */}
          <img
            src={plusJoin}
            alt=""
            aria-hidden
            className="pointer-events-none absolute hidden size-[68px] lg:block"
            style={{ left: "calc((100% - 74px) * 454 / 966 + 3px)", top: "calc(50% - 24px)" }}
          />

          <InsightsPanel
            loading={!!product && insights.isLoading}
            data={product ? insights.data : undefined}
          />
        </section>

        <section className="flex flex-col gap-[30px]">
          <SectionTitle>Creative theme · pick one</SectionTitle>
          <div
            className="grid grid-cols-2 gap-[22px] md:grid-cols-3 xl:grid-cols-4"
            role="radiogroup"
            aria-label="Creative theme"
          >
            {themes.map((t) => {
              const active = theme?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(t)}
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-[12px] border-[0.8px] bg-v2-surface text-left transition-colors",
                    active
                      ? "border-black night:border-v2-ink"
                      : "border-transparent hover:border-v2-border",
                  )}
                >
                  {/* Square like the theme previews (800×800), so no headline is cropped. */}
                  <span className="block aspect-square overflow-hidden rounded-[12px]">
                    <img
                      src={t.imageUrl}
                      alt=""
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </span>
                  <span className="px-[14px] py-[14px]">
                    <span className="type-label text-black night:text-v2-ink">{t.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 lg:bottom-6 lg:left-[308px]">
        <div className="pointer-events-auto w-full max-w-[622px]">
          <ComposerBar
            product={product}
            onPickProduct={() => setPickerOpen(true)}
            chips={
              <>
                {theme ? (
                  <TemplateChip name={`Theme: ${theme.name}`} imageUrl={theme.imageUrl} />
                ) : null}
                <StudioBrandChip brand={brand} />
              </>
            }
            aspect={aspect}
            onAspectChange={setAspect}
            count={count}
            onCountChange={setCount}
            unit={["ad", "ads"]}
            note={note}
            onNoteChange={setNote}
            cost={adGenerationCost(count)}
            canGenerate={!!product && !!theme && !insights.isLoading}
            generateHint={
              missingHint([!product && "a product", !theme && "a creative theme"]) ??
              "Still reading your product. One moment."
            }
            onGenerate={() =>
              generate({
                studio: "ad",
                kind: "ad",
                inputs: { studio: "ad", themeId: theme?.id ?? null },
                product: product!,
                style: theme
                  ? { label: `Theme: ${theme.name}`, imageUrl: theme.imageUrl }
                  : undefined,
                aspect,
                count,
                note: note.trim() || undefined,
                cost: adGenerationCost(count),
                ...brand.request,
              })
            }
            generating={generating}
          />
        </div>
      </div>

      <ProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(next) => {
          setProduct(next);
          setTheme(null);
        }}
        initialSelectedId={product?.id}
      />
    </AppShell>
  );
}

function AddProductCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[305px] flex-col items-center justify-center gap-2.5 rounded-[12px] border border-dashed border-black/20 bg-v2-surface transition-colors hover:border-v2-blue night:border-v2-border"
    >
      <span aria-hidden className="relative block h-[123px] w-[179px]">
        <img
          src={artMocha}
          alt=""
          className="absolute left-[103.65px] top-[57.15px] h-[61.6px] w-[60.8px] rounded-[10px] object-cover"
        />
        <img
          src={artSodaHand}
          alt=""
          className="absolute left-[138.26px] top-[10.72px] h-[41.4px] w-[40.5px] rounded-[10px] object-cover"
        />
        <img
          src={artSodaCherry}
          alt=""
          className="absolute left-[60.36px] top-[19.28px] h-[75.1px] w-[74.3px] rounded-[10px] object-cover"
        />
        <img
          src={artTruffle}
          alt=""
          className="absolute left-[7.42px] top-[33.51px] h-[75.1px] w-[74.3px] rounded-[10px] object-cover"
        />
        <span className="absolute left-0 top-[85.8px] h-[37.1px] w-[170.75px] bg-gradient-to-b from-transparent to-[var(--v2-surface)]" />
        <span className="absolute left-0 top-0 h-[37.1px] w-[179px] -scale-y-100 bg-gradient-to-b from-transparent to-[var(--v2-surface)]" />
      </span>
      <span className="flex flex-col items-center gap-2">
        <span className="type-label text-[#212121] night:text-v2-ink">Add Your Product</span>
        <span className="font-inter-tight text-xs text-v2-muted">
          Pick from your catalogue or upload an image
        </span>
      </span>
    </button>
  );
}

function ProductCard({
  product,
  onChange,
  onDelete,
}: {
  product: Product;
  onChange: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-[25px] rounded-[12px] border border-black/20 bg-v2-surface p-[18px] night:border-v2-border">
      <div className="flex w-[165px] shrink-0 flex-col gap-4">
        <img
          src={product.imageUrl}
          alt=""
          className="aspect-[165/175] w-full rounded-[12px] object-cover"
        />
        <div className="flex flex-col items-start gap-2 pl-0.5">
          <button
            type="button"
            onClick={onChange}
            className="rounded-[60px] border border-[#0d2348] bg-[#f5f5f5] px-[14px] py-[7px] font-archivo text-xs leading-[1.4] text-[#12213d] hover:bg-white night:border-v2-ink night:bg-v2-surface-2 night:text-v2-ink"
          >
            Change
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-[60px] border border-[#c93030] px-[14px] py-[7px] font-archivo text-xs leading-[1.4] text-[#c93030] hover:bg-[#c93030]/5"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="flex min-w-0 flex-col pt-2.5">
        <h2 className="type-card-title text-v2-ink">{product.name}</h2>
        {product.description ? (
          <p className="mt-4 type-subtitle text-v2-ink-70">{product.description}</p>
        ) : null}
        {product.price ? (
          <p className="mt-4 font-inter-tight text-lg font-semibold text-[#343434] night:text-v2-ink">
            {product.price}
          </p>
        ) : null}
        <p className="mt-auto pt-4 font-inter-tight text-xs text-v2-muted">
          From: {product.source === "shopify" ? "Shopify" : "Upload"}
        </p>
      </div>
    </div>
  );
}

function SkeletonLines({ widths }: { widths: string[] }) {
  return (
    <div className="flex flex-col gap-[9px]">
      {widths.map((w, i) => (
        <span
          key={i}
          className="h-2.5 animate-pulse rounded-[33px] bg-[#f5f5f5] night:bg-v2-surface-2"
          style={{ width: w }}
        />
      ))}
    </div>
  );
}

function InsightsPanel({
  loading,
  data,
}: {
  loading: boolean;
  data: { painPoints: string[]; adAngles: string[] } | undefined;
}) {
  return (
    <div
      className="flex min-h-[305px] flex-col rounded-[12px] bg-v2-surface px-6 pb-6 pt-[18px]"
      aria-busy={loading}
    >
      <h2 className="type-card-title text-v2-ink">Product Insights</h2>
      {data ? (
        <>
          <p className="mt-2 font-inter-tight text-sm font-medium leading-[1.73] text-[#222]/70 night:text-v2-ink-70">
            Pain points
          </p>
          <ul className="list-disc pl-5 font-inter-tight text-sm font-light leading-[27px] tracking-[0.28px] text-[#616161] night:text-v2-ink-70">
            {data.painPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="mt-3 font-inter-tight text-sm font-medium leading-[1.73] text-[#222]/70 night:text-v2-ink-70">
            Ad angles
          </p>
          <div className="mt-2 flex flex-wrap gap-[11px]">
            {data.adAngles.map((angle) => (
              <span
                key={angle}
                className="rounded-[50px] border-[0.7px] border-black/60 px-3 py-1.5 font-inter-tight text-xs tracking-[0.24px] text-[#616161] night:border-v2-border night:text-v2-ink-70"
              >
                {angle}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-6 flex flex-col gap-[78px]">
          <SkeletonLines widths={["100%", "88%", "78%"]} />
          <SkeletonLines widths={["100%", "100%", "42%"]} />
          {loading ? (
            <p className="-mt-12 font-inter-tight text-xs text-v2-muted">
              Reading your product page and reviews…
            </p>
          ) : (
            <p className="-mt-12 font-inter-tight text-xs text-v2-muted">
              Add a product and we’ll list your customers’ pain points and the best ad angles.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
