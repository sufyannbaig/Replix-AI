import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useGenerate } from "@/v2/components/studio/useGenerate";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { FilterTabs, SectionTitle } from "@/v2/components/primitives";
import {
  ComposerBar,
  isAspect,
  missingHint,
  TemplateChip,
  useStickySetting,
} from "@/v2/components/studio/ComposerBar";
import { StudioBrandChip, useStudioBrand } from "@/v2/components/brand/BrandMenus";
import { ProductPicker } from "@/v2/components/studio/ProductPicker";
import { StudioSteps } from "@/v2/components/studio/StudioSteps";
import {
  usePreselectedProduct,
  adGenerationCost,
  useAdThemes,
  useProductInsights,
} from "@/v2/data/api";
import { B2B_CTAS } from "@/v2/data/types";
import type { AdAudience, AdTheme, AspectRatio, Product } from "@/v2/data/types";
import plusJoin from "@/assets/v2/icons/plus-join.svg";
import artMocha from "@/assets/v2/catalog/product/acme-linen-shirt.webp";
import artSodaHand from "@/assets/v2/catalog/ad/testimonial.webp";
import artSodaCherry from "@/assets/v2/catalog/product/acme-charge.webp";
import artTruffle from "@/assets/v2/catalog/product/acme-glow-serum.webp";

export const Route = createFileRoute("/_app/ad-studio")({
  validateSearch: (search: Record<string, unknown>): { product?: string } =>
    typeof search.product === "string" ? { product: search.product } : {},
  head: () => ({ meta: [{ title: "Ad Studio · Replix AI" }] }),
  component: AdStudioPage,
});

const AUDIENCES = [
  { value: "b2c", label: "Selling to shoppers" },
  { value: "b2b", label: "Selling to businesses" },
] as const;
const QUOTE_THEMES = ["testimonial", "b2b-quote"];

function AdStudioPage() {
  const { generate, pending: generating } = useGenerate();
  /* Who the ads are for. Remembered in this browser; it changes the themes, the insights,
     the copy and the button. */
  const [audience, setAudienceRaw] = useStickySetting<AdAudience>(
    "ad-audience",
    "b2c",
    (v) => v === "b2c" || v === "b2b",
  );
  const b2b = audience === "b2b";
  const [cta, setCta] = useState<string>(B2B_CTAS[0]);
  const [proof, setProof] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  /* "Make Ad" on a product card opens the studio with that product picked. */
  usePreselectedProduct(Route.useSearch().product, product, setProduct);
  const [pickerOpen, setPickerOpen] = useState(false);
  /* With more than one ad, several themes can be picked (up to one per ad); the ads take
     them in turn. */
  const [picked, setPicked] = useState<AdTheme[]>([]);
  const theme = picked[0] ?? null;
  /* Size and count are remembered for the next visit. */
  const [aspect, setAspect] = useStickySetting<AspectRatio>("ad-aspect", "1:1", isAspect);
  const [count, setCountRaw] = useStickySetting(
    "ad-count",
    1,
    (v) => typeof v === "number" && v >= 1 && v <= 4,
  );
  const setCount = (next: number) => {
    setCountRaw(next);
    setPicked((list) => list.slice(0, Math.max(1, next)));
  };
  const toggleTheme = (t: AdTheme) =>
    setPicked((list) => {
      if (count <= 1) return [t];
      if (list.some((x) => x.id === t.id)) return list.filter((x) => x.id !== t.id);
      /* Full: the newest pick replaces the oldest. */
      return [...list, t].slice(-count);
    });
  const multi = count > 1;
  const themeLabel =
    picked.length > 1 ? `Themes: ${picked.map((t) => t.name).join(", ")}` : `Theme: ${theme?.name}`;
  const [note, setNote] = useState("");
  /* Testimonial ads quote a real review only; without one they speak in the brand's voice. */
  const [review, setReview] = useState("");
  const wantsReview = picked.some((t) => QUOTE_THEMES.includes(t.id));
  const wantsProof = picked.some((t) => t.id === "b2b-proof" || t.id === "stats");
  /* Offer / Sale: the user's real deal; without one the ad gives a true reason to buy now. */
  const [offer, setOffer] = useState("");
  const wantsOffer = picked.some((t) => t.id === "offer-sale");
  const wantsScreen = picked.some((t) => t.id === "b2b-screen");
  const setAudience = (next: AdAudience) => {
    setAudienceRaw(next);
    setPicked([]);
  };
  const insights = useProductInsights(product, audience);
  const { data: themes = [] } = useAdThemes(audience);
  const brand = useStudioBrand(product);

  return (
    <AppShell title="Ad Studio" subtitle="Turn one product into ready-to-run ad creatives">
      <div className="mt-10 flex flex-col gap-10 pb-2 sm:pb-[160px]">
        <StudioSteps
          steps={[
            { label: "Product", done: !!product, onClick: () => setPickerOpen(true) },
            { label: "Theme", done: !!theme },
            { label: "Generate", done: false },
          ]}
        />

        <FilterTabs
          options={AUDIENCES}
          value={audience}
          onChange={setAudience}
          label="Who the ads are for"
          className="self-start"
        />

        <section className="relative grid gap-5 lg:grid-cols-[454fr_512fr] lg:gap-[74px]">
          {product ? (
            <ProductCard
              product={product}
              onChange={() => setPickerOpen(true)}
              onDelete={() => {
                setProduct(null);
                setPicked([]);
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
          <SectionTitle>
            {multi ? `Creative themes · pick up to ${count}` : "Creative theme · pick one"}
          </SectionTitle>
          <div
            className={cn("grid grid-cols-2 gap-[22px] md:grid-cols-3", "xl:grid-cols-5")}
            role={multi ? "group" : "radiogroup"}
            aria-label={multi ? "Creative themes" : "Creative theme"}
          >
            {themes.map((t) => {
              const active = picked.some((x) => x.id === t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role={multi ? "checkbox" : "radio"}
                  aria-checked={active}
                  aria-label={t.name}
                  onClick={() => toggleTheme(t)}
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
          {wantsReview ? (
            <label className="flex flex-col gap-2 rounded-[12px] bg-v2-surface p-5">
              <span className="type-label text-black night:text-v2-ink">
                Paste a real customer review (optional)
              </span>
              <span className="font-inter-tight text-xs text-v2-muted">
                {b2b ? "Customer quote" : "Testimonial"} ads quote it word for word. Without one,
                the ad speaks in your brand's own voice, because ad platforms and the law don't
                allow made-up reviews.
              </span>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Best serum I've used. My skin felt softer within a week."
                className="resize-none rounded-[8px] bg-v2-canvas px-3 py-2 font-inter-tight text-sm leading-[1.4] text-v2-ink outline-none placeholder:text-v2-muted"
              />
            </label>
          ) : null}
          {wantsScreen ? (
            <p className="rounded-[12px] bg-v2-surface p-5 font-inter-tight text-xs text-v2-muted">
              Product Screen ads show your product's photo inside a laptop, exactly as it is. For
              software, add a screenshot of your app as the product photo. Only the words are
              written by AI.
            </p>
          ) : null}
          {wantsProof ? (
            <label className="flex flex-col gap-2 rounded-[12px] bg-v2-surface p-5">
              <span className="type-label text-black night:text-v2-ink">
                {b2b ? "Your proof number" : "Your number"} (optional)
              </span>
              <span className="font-inter-tight text-xs text-v2-muted">
                A real figure you can back up. We use it exactly as you type it and never make
                numbers up; without one, the ad leads with a fact about the product.
              </span>
              <input
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                maxLength={200}
                placeholder={
                  b2b
                    ? "Cuts packing time by 40% (2025 customer survey)"
                    : "12 hours of battery on one charge"
                }
                className="rounded-[8px] bg-v2-canvas px-3 py-2 font-inter-tight text-sm text-v2-ink outline-none placeholder:text-v2-muted"
              />
            </label>
          ) : null}
          {wantsOffer ? (
            <label className="flex flex-col gap-2 rounded-[12px] bg-v2-surface p-5">
              <span className="type-label text-black night:text-v2-ink">Your offer (optional)</span>
              <span className="font-inter-tight text-xs text-v2-muted">
                A real deal you're running. The ad uses it exactly as you type it; without one, it
                gives a true reason to buy now and never makes a deal up.
              </span>
              <input
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                maxLength={120}
                placeholder="20% off this weekend with code SPRING"
                className="rounded-[8px] bg-v2-canvas px-3 py-2 font-inter-tight text-sm text-v2-ink outline-none placeholder:text-v2-muted"
              />
            </label>
          ) : null}
        </section>

        {b2b ? (
          <section className="flex flex-col gap-[18px]">
            <SectionTitle>Button on the ad</SectionTitle>
            <FilterTabs
              options={B2B_CTAS.map((c) => ({ value: c, label: c }))}
              value={cta}
              onChange={setCta}
              label="Button on the ad"
              className="self-start"
            />
          </section>
        ) : null}
      </div>

      <div className="pointer-events-none z-20 flex justify-center px-4 max-sm:mt-8 max-sm:px-0 sm:fixed sm:inset-x-0 sm:bottom-4 lg:bottom-6 lg:left-[308px]">
        <div className="pointer-events-auto w-full max-w-[622px]">
          <ComposerBar
            product={product}
            onPickProduct={() => setPickerOpen(true)}
            chips={
              <>
                {theme ? <TemplateChip name={themeLabel} imageUrl={theme.imageUrl} /> : null}
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
                inputs: {
                  studio: "ad",
                  themeId: theme?.id ?? null,
                  ...(picked.length > 1 ? { themeIds: picked.map((t) => t.id) } : {}),
                  ...(wantsReview && review.trim() ? { review: review.trim() } : {}),
                  ...(b2b ? { audience, cta } : {}),
                  ...(wantsProof && proof.trim() ? { proof: proof.trim() } : {}),
                  ...(wantsOffer && offer.trim() ? { offer: offer.trim() } : {}),
                },
                product: product!,
                style: theme ? { label: themeLabel, imageUrl: theme.imageUrl } : undefined,
                aspect,
                count,
                note: note.trim() || undefined,
                cost: adGenerationCost(count),
                ...brand.request,
              })
            }
            generating={generating}
            onMissing={() => {
              if (!product) setPickerOpen(true);
              else window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </div>

      <ProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        /* The picked themes stay: they don't depend on the product. */
        onSelect={setProduct}
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
