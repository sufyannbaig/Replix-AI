import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, MoreHorizontal, Pencil, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { PillButton, SectionTitle, pillClass } from "@/v2/components/primitives";
import { BrandEditor } from "@/v2/components/brand/BrandEditor";
import { FontSample } from "@/v2/components/brand/FontPicker";
import {
  BrandLimitError,
  useBrandKitLimit,
  useBrandKits,
  useDeleteBrandKit,
  useExtractBrandKit,
  useSetDefaultBrandKit,
} from "@/v2/data/api";
import { BRAND_KIT_LIMITS } from "@/v2/data/pricing";
import { brandLogo, type BrandKit } from "@/v2/data/types";
import logoMark from "@/assets/v2/logo-mark.png";
import assetCap from "@/assets/v2/brand/asset-cap.png";
import assetBottle from "@/assets/v2/brand/asset-bottle.png";
import linkA from "@/assets/v2/brand/link-a.svg";
import linkB from "@/assets/v2/brand/link-b.svg";
import linkC from "@/assets/v2/brand/link-c.svg";

type BrandKitSearch = { new?: "1"; kit?: string };

export const Route = createFileRoute("/_app/brand-kit")({
  validateSearch: (search: Record<string, unknown>): BrandKitSearch => ({
    ...(search.new === "1" || search.new === 1 ? { new: "1" as const } : {}),
    ...(typeof search.kit === "string" && search.kit.length <= 64 ? { kit: search.kit } : {}),
  }),
  head: () => ({ meta: [{ title: "Brand Kit · Replix AI" }] }),
  component: BrandKitPage,
});

/* Figma's subtitle reads "Upload Or Setup Your Brand Kit For Further Result". */
const SUBTITLE = "Logo, colours, fonts and tone applied to every generation";

function normaliseWebsite(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.hostname.includes(".") ? url.hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  scale: "Scale",
};

function BrandKitPage() {
  const { data: kits = [] } = useBrandKits();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const limit = useBrandKitLimit();
  const extract = useExtractBrandKit();
  const setDefault = useSetDefaultBrandKit();
  const remove = useDeleteBrandKit();
  const [editing, setEditing] = useState<{ kit?: BrandKit } | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BrandKit | null>(null);

  const saved = kits.filter((k) => k.id !== "new");
  const blocked = search.new === "1" && limit.ready && saved.length > 0 && !limit.canAdd;
  const adding = (search.new === "1" && !blocked) || saved.length === 0;
  const kit = adding ? undefined : (saved.find((k) => k.id === search.kit) ?? saved[0]);
  const select = (id: string) => navigate({ search: { kit: id }, replace: true });

  const planMessage = `Your ${PLAN_NAMES[limit.plan] ?? "current"} plan includes ${limit.limit} brand${limit.limit === 1 ? "" : "s"}.`;

  // "Create a New Brand Kit" in the sidebar links to ?new=1; at the limit, explain instead.
  useEffect(() => {
    if (!blocked) return;
    setLimitMessage(planMessage);
    navigate({ search: {}, replace: true });
  }, [blocked, planMessage, navigate]);

  const addBrand = () => {
    if (!limit.canAdd) {
      setLimitMessage(planMessage);
      return;
    }
    navigate({ search: { new: "1" } });
  };

  const run = (website: string, target?: BrandKit) => {
    extract.mutate(
      { kitId: target?.id ?? "new", website },
      {
        onSuccess: (done) => {
          toast.success("Brand kit ready. It now shapes this brand's ads.");
          select(done.id);
        },
        onError: (error) => {
          if (error instanceof BrandLimitError) setLimitMessage(error.message);
          else toast.error("We couldn't read that website. Try again or set it up manually.");
        },
      },
    );
  };

  return (
    <AppShell title="Brand Kit" subtitle={SUBTITLE}>
      {saved.length ? (
        <BrandRow
          kits={saved}
          selectedId={kit?.id}
          adding={adding}
          limit={limit}
          onSelect={select}
          onAdd={addBrand}
        />
      ) : null}

      {kit?.isComplete ? (
        <>
          <div className="mt-[30px] flex flex-wrap items-center justify-end gap-2">
            {kit.isDefault ? (
              <span className="mr-auto flex items-center gap-1.5 font-inter-tight text-sm text-v2-ink-70">
                <Star className="size-4 fill-[#ffcc50] text-[#ffcc50]" />
                Default brand: used for products without a brand of their own
              </span>
            ) : null}
            {kit.website ? (
              <PillButton
                variant="outline"
                className="opacity-60 hover:opacity-100"
                disabled={extract.isPending}
                onClick={() => kit.website && run(kit.website, kit)}
              >
                {extract.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Re-sync From Website
              </PillButton>
            ) : null}
            <PillButton variant="outline" onClick={() => setEditing({ kit })}>
              <Pencil className="size-4" />
              Edit Brand
            </PillButton>
            <KitMenu
              kit={kit}
              onMakeDefault={() =>
                setDefault.mutate(kit.id, {
                  onSuccess: () => toast.success(`${kit.name} is now your default brand`),
                  onError: (e) => toast.error(e.message),
                })
              }
              onDelete={() => setConfirmDelete(kit)}
            />
          </div>
          <FilledKit kit={kit} />
        </>
      ) : (
        <EmptyKit
          pending={extract.isPending}
          onExtract={(site) => run(site, kit)}
          onManual={() => setEditing({ kit })}
          title={kit ? `Set up ${kit.name}` : saved.length ? "Add a brand" : undefined}
        />
      )}

      <BrandEditor
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        kit={editing?.kit}
        onSaved={(done) => select(done.id)}
        onLimit={(message) => {
          setEditing(null);
          setLimitMessage(message);
        }}
      />

      <Dialog open={!!limitMessage} onOpenChange={(open) => !open && setLimitMessage(null)}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[440px] rounded-[18px] border-none bg-v2-surface p-6 text-v2-ink">
          <DialogTitle className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px]">
            Add more brands
          </DialogTitle>
          <DialogDescription className="font-inter-tight text-sm leading-relaxed text-v2-ink-70">
            {limitMessage} Pro includes {BRAND_KIT_LIMITS.pro} brands and Scale includes{" "}
            {BRAND_KIT_LIMITS.scale}, each with its own logo, colours and fonts.
          </DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <PillButton variant="outline" onClick={() => setLimitMessage(null)}>
              Not now
            </PillButton>
            <Link to="/upgrade" className={pillClass("primary")}>
              See plans
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="w-[calc(100vw-32px)] max-w-[440px] rounded-[18px] border-none bg-v2-surface p-6 text-v2-ink">
          <DialogTitle className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px]">
            Delete {confirmDelete?.name}?
          </DialogTitle>
          <DialogDescription className="font-inter-tight text-sm leading-relaxed text-v2-ink-70">
            Its logo, colours, fonts and tone are removed.{" "}
            {saved.length > 1
              ? "Its products switch to your default brand."
              : "Its products will have no brand until you add one."}{" "}
            Ads you already made don&apos;t change.
          </DialogDescription>
          <div className="mt-2 flex justify-end gap-2">
            <PillButton variant="outline" onClick={() => setConfirmDelete(null)}>
              Keep it
            </PillButton>
            <PillButton
              variant="outline"
              className="border-[#c93030] bg-[#c93030] text-white hover:bg-[#b02828] night:border-[#c93030]"
              disabled={remove.isPending}
              onClick={() => {
                const target = confirmDelete;
                if (!target) return;
                remove.mutate(target.id, {
                  onSuccess: () => {
                    toast.success(`${target.name} deleted`);
                    setConfirmDelete(null);
                    navigate({ search: {}, replace: true });
                  },
                  onError: (e) => toast.error(e.message),
                });
              }}
            >
              {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete brand
            </PillButton>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/* ---------- Brand switcher ---------- */

function BrandRow({
  kits,
  selectedId,
  adding,
  limit,
  onSelect,
  onAdd,
}: {
  kits: BrandKit[];
  selectedId?: string;
  adding: boolean;
  limit: { limit: number; used: number; canAdd: boolean };
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-2 lg:mt-[30px]">
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {kits.map((k) => {
          const active = k.id === selectedId;
          const logo = brandLogo(k);
          return (
            <button
              key={k.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(k.id)}
              className={cn(
                "flex w-[212px] shrink-0 items-center gap-3 rounded-[14px] bg-v2-surface p-3 text-left transition-colors",
                active ? "v2-highlight-stroke" : "border border-transparent hover:border-v2-line",
              )}
            >
              <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-black/[0.08] bg-white">
                {logo ? (
                  <img src={logo} alt="" className="max-h-9 max-w-9 object-contain" />
                ) : (
                  <span className="font-archivo text-lg font-semibold text-[#5b6170]">
                    {k.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-archivo text-base font-medium text-v2-ink">
                    {k.name}
                  </span>
                  {k.isDefault ? (
                    <Star
                      aria-label="Default brand"
                      className="size-3.5 shrink-0 fill-[#ffcc50] text-[#ffcc50]"
                    />
                  ) : null}
                </span>
                <span className="flex gap-1">
                  {k.colors.length ? (
                    k.colors
                      .slice(0, 5)
                      .map((c) => (
                        <span
                          key={c}
                          className="size-3.5 rounded-full border border-black/10"
                          style={{ background: c }}
                        />
                      ))
                  ) : (
                    <span className="font-inter-tight text-xs text-v2-ink-60">Not set up yet</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={adding}
          onClick={onAdd}
          className={cn(
            "flex w-[150px] shrink-0 items-center justify-center gap-2 rounded-[14px] border border-dashed p-3 font-archivo text-base text-v2-ink-70 transition-colors hover:border-v2-blue hover:text-v2-blue",
            adding
              ? "border-v2-blue text-v2-blue"
              : "border-[rgba(2,2,2,0.27)] night:border-v2-border",
          )}
        >
          <Plus className="size-4" />
          Add brand
        </button>
      </div>
      <p className="font-inter-tight text-xs text-v2-ink-60">
        {limit.used} of {limit.limit} brand{limit.limit === 1 ? "" : "s"} on your plan
      </p>
    </div>
  );
}

function KitMenu({
  kit,
  onMakeDefault,
  onDelete,
}: {
  kit: BrandKit;
  onMakeDefault: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`More actions for ${kit.name}`}
        className="flex size-[45px] items-center justify-center rounded-full border border-[#a2a2a2] bg-v2-surface text-v2-ink hover:bg-v2-surface-2 night:border-v2-border"
      >
        <MoreHorizontal className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px] rounded-[12px] bg-v2-surface">
        <DropdownMenuItem disabled={kit.isDefault} onSelect={onMakeDefault}>
          <Star className="size-4" />
          {kit.isDefault ? "Default brand" : "Make default"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} className="text-[#c93030] focus:text-[#c93030]">
          <Trash2 className="size-4" />
          Delete brand
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------- Empty state (Figma 543:25614) ---------- */

function Callout({ className, children }: { className: string; children: ReactNode }) {
  return <div className={cn("absolute rounded-[6px] bg-white", className)}>{children}</div>;
}

function EmptyKit({
  pending,
  onExtract,
  onManual,
  title = "Set up your brand kit",
}: {
  pending: boolean;
  onExtract: (website: string) => void;
  onManual: () => void;
  title?: string;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    const site = normaliseWebsite(value);
    if (!site) {
      toast.error("Enter a website like acme.com");
      return;
    }
    onExtract(site);
  };

  return (
    <section className="mx-auto mt-10 flex max-w-[686px] flex-col items-center overflow-hidden rounded-[18px] bg-v2-surface px-6 pb-10 pt-[42px] sm:px-[90px] sm:pb-[27px]">
      {/* Brand moodboard illustration: colours, logo, type and assets around a card. */}
      <div
        aria-hidden
        className={cn(
          "relative h-[201px] w-[392px] shrink-0 origin-top max-sm:-mb-[50px] max-sm:scale-75",
          pending && "animate-pulse",
        )}
      >
        <img src={linkA} alt="" className="absolute left-[255px] top-0 h-[25.7px] w-[30.7px]" />
        <img src={linkB} alt="" className="absolute left-[90px] top-[23px] h-[15.7px] w-[42.7px]" />
        <img
          src={linkC}
          alt=""
          className="absolute left-[257px] top-[147px] h-[33.7px] w-[15.7px]"
        />
        <div className="absolute left-[114px] top-[25px] h-[131px] w-[176px] rounded-[14px] bg-[#f5f5f5] shadow-[0_0_26.8px_rgba(0,0,0,0.04)]" />
        <img
          src={logoMark}
          alt=""
          className="absolute left-[168px] top-[57px] size-[68px] rounded-[6px] object-cover"
        />
        <Callout className="left-0 top-[38px] h-[82px] w-[120px] px-2 pt-2 shadow-[1px_4px_14.2px_rgba(232,169,59,0.08)]">
          <p className="font-archivo text-[10px] font-medium leading-[1.4] text-black">
            Brand Colour
          </p>
          <div className="mt-2.5 flex justify-between">
            {["#162544", "#fab91b", "#f5f5f5"].map((c) => (
              <span key={c} className="h-[42px] w-7 rounded-[4px]" style={{ background: c }} />
            ))}
          </div>
        </Callout>
        <Callout className="left-[272px] top-[4px] h-[92px] w-[120px] px-[11px] pt-[11px] shadow-[1px_4px_14.2px_rgba(153,186,255,0.44)]">
          <p className="font-archivo text-lg font-semibold leading-none text-black">Aa</p>
          <p className="mt-1 font-archivo text-xs font-medium leading-[1.4] text-black">Archivo</p>
          <p className="mt-[22px] flex gap-1.5 font-archivo text-[8px] leading-[1.4] text-black opacity-50">
            <span>Aa</span>
            <span>Bb</span>
            <span>Cc</span>
            <span>Dd</span>
            <span>Ee</span>
            <span>Ff</span>
          </p>
        </Callout>
        <Callout className="left-[272px] top-[120px] h-[81px] w-[120px] px-2 pt-2 shadow-[4px_3px_16.1px_rgba(0,0,0,0.05)]">
          <p className="font-archivo text-[10px] font-medium leading-[1.4] text-black">
            Brand Assets
          </p>
          <div className="mt-2 flex gap-2.5">
            <img src={assetCap} alt="" className="h-9 w-[47px] rounded-[5px] object-cover" />
            <img src={assetBottle} alt="" className="h-9 w-[47px] rounded-[5px] object-cover" />
          </div>
        </Callout>
      </div>

      <div className="mt-[22px] flex w-full flex-col items-center gap-[13px] text-center">
        <h2 className="type-page-title text-v2-ink">{pending ? "Reading your website…" : title}</h2>
        <p className="max-w-[374px] type-subtitle text-v2-ink-70">
          {pending
            ? "Pulling your logo, colours, fonts, tone of voice and brand images."
            : "Paste your website. We pull your logo, colours, fonts, tone of voice and brand images for you."}
        </p>
        <form
          className="mt-[10px] flex w-full flex-col gap-[7px] sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            inputMode="url"
            placeholder="Paste your website link, e.g. acme.com"
            aria-label="Website"
            className="h-[49px] w-full min-w-0 shrink-0 rounded-[50px] border border-[#a2a2a2] sm:w-auto sm:flex-1 bg-transparent px-5 font-inter-tight text-sm text-v2-ink outline-none placeholder:text-xs placeholder:text-v2-ink-70 focus:border-v2-blue night:border-v2-border"
          />
          <PillButton type="submit" disabled={pending} className="h-[49.88px]">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Extract
          </PillButton>
        </form>
      </div>

      <div className="mt-5 flex w-full items-center gap-[19px] font-inter-tight text-base text-v2-ink-70">
        <span className="h-px flex-1 bg-black/20 night:bg-v2-line" />
        Or
        <span className="h-px flex-1 bg-black/20 night:bg-v2-line" />
      </div>
      <PillButton variant="outline" className="mt-[14px]" disabled={pending} onClick={onManual}>
        Set Up Manually
      </PillButton>
    </section>
  );
}

/* ---------- Filled state (Figma 543:72077) ---------- */

function Card({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn("flex flex-col gap-[23px] rounded-[14px] bg-v2-surface p-[18px]", className)}
    >
      <h2 className="type-card-title text-v2-ink">{title}</h2>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="font-inter-tight text-sm text-v2-ink-60">{children}</p>;
}

function FilledKit({ kit }: { kit: BrandKit }) {
  return (
    <div className="mt-[29px] flex flex-col gap-10">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card title="Logo">
          {kit.logos.length ? (
            <div className="flex gap-[30px]">
              {kit.logos.slice(0, 2).map((logo, i) => (
                <img
                  key={logo}
                  src={logo}
                  alt={i === 0 ? `${kit.name} logo` : `${kit.name} logo, light version`}
                  className={cn(
                    "h-[115px] w-[134px] rounded-[6px] border border-black/[0.13] object-contain p-3",
                    i > 0 ? "bg-[#12213d]" : "bg-white",
                  )}
                />
              ))}
            </div>
          ) : (
            <EmptyNote>No logo yet. Add one with Edit Brand.</EmptyNote>
          )}
        </Card>
        <Card title="Colours">
          <div className={cn("flex h-[114px] justify-between", !kit.colors.length && "hidden")}>
            {kit.colors.map((hex) => (
              <div key={hex} className="flex w-[58px] flex-col gap-[13px]">
                <span
                  className="flex-1 rounded-[6px] border border-black/10"
                  style={{ background: hex }}
                />
                <span className="text-center type-caption text-v2-ink-70">{hex}</span>
              </div>
            ))}
          </div>
          {kit.colors.length ? null : (
            <EmptyNote>No colours yet. Ads use a colour from the product photo.</EmptyNote>
          )}
        </Card>
        <Card title="Fonts">
          {kit.fonts ? (
            <div className="flex h-[114px] flex-col justify-between">
              <div className="flex items-start gap-[25px]">
                <FontSample
                  family={kit.fonts.heading}
                  url={kit.fontFiles?.heading}
                  weight={700}
                  className="font-archivo text-[57px] font-semibold leading-[0.75] tracking-[-1.14px] text-v2-ink"
                >
                  Aa
                </FontSample>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate type-card-title text-v2-ink">{kit.fonts.heading}</span>
                  <span className="truncate font-inter-tight text-base tracking-[-0.32px] text-v2-ink-60">
                    {kit.fonts.body}
                  </span>
                </span>
              </div>
              {/* Figma repeats the setup copy here; describe how the fonts are used instead. */}
              <p className="type-caption text-v2-ink-70">
                {kit.fonts.heading} for headlines, {kit.fonts.body} for body copy and buttons.
              </p>
            </div>
          ) : (
            <EmptyNote>No fonts yet. Ads use each layout&apos;s own fonts.</EmptyNote>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
        <Card title="Tone Of Voice" className="gap-[22px]">
          <div className="flex flex-col gap-[17px]">
            <div className="flex flex-wrap gap-[11px]">
              {kit.toneTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[50px] border-[0.7px] border-black/60 px-3 py-1.5 font-inter-tight text-xs tracking-[0.24px] text-[#616161] night:border-v2-border night:text-v2-ink-70"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="type-subtitle text-v2-ink-70">
              {kit.tone ?? (kit.toneTags.length ? null : "No tone of voice yet.")}
            </p>
          </div>
        </Card>
        <Card title="About & Audience" className="gap-[22px]">
          <p className="type-subtitle text-v2-ink-70">{kit.audience ?? "No audience yet."}</p>
        </Card>
      </div>

      <section className={cn("flex flex-col gap-[30px]", !kit.images.length && "hidden")}>
        {/* Figma calls these "Product Images"; per the wireframe they are the brand's images. */}
        <SectionTitle>Brand Images</SectionTitle>
        <div className="grid grid-cols-2 gap-5 rounded-[18px] bg-v2-surface px-3 py-4 sm:grid-cols-3 sm:px-[27px] sm:py-7 lg:grid-cols-5">
          {kit.images.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              className="aspect-[183/231] w-full rounded-[12px] object-cover"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
