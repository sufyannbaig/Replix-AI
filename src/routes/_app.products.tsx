import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AppShell } from "@/v2/components/shell/AppShell";
import { PillButton, pillClass } from "@/v2/components/primitives";
import { importProductFromUrl, useAddProduct, useProducts } from "@/v2/data/api";
import type { Product, ProductSource } from "@/v2/data/types";
import closeIcon from "@/assets/v2/icons/close.svg";

export const Route = createFileRoute("/_app/products")({
  head: () => ({ meta: [{ title: "Products · Replix AI" }] }),
  component: ProductsPage,
});

const FILTERS: { value: "all" | ProductSource; label: string }[] = [
  { value: "all", label: "All" },
  { value: "shopify", label: "Shopify" },
  { value: "upload", label: "Uploaded" },
];

function SourceBadge({ source }: { source: ProductSource }) {
  return (
    <span
      className={cn(
        "flex h-7 shrink-0 items-center rounded-[50px] border-[0.7px] bg-white px-3 font-inter-tight text-xs font-medium tracking-[0.24px] night:bg-transparent",
        source === "shopify"
          ? "border-black/60 text-[#616161] night:border-v2-border night:text-v2-ink-70"
          : "border-[rgba(76,130,42,0.6)] text-[rgba(76,130,42,0.76)]",
      )}
    >
      {source === "shopify" ? "Shopify" : "Uploaded"}
    </span>
  );
}

function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ProductSource>("all");
  const [addOpen, setAddOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => filter === "all" || p.source === filter)
      .filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products, query, filter]);

  return (
    <AppShell
      title="Products"
      subtitle="Everything you can create with, from Shopify and your uploads"
    >
      <div className="mt-[31px] flex flex-col gap-10">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex h-[49px] w-full items-center gap-[19px] rounded-[50px] border border-[rgba(162,162,162,0.36)] bg-v2-surface px-[21px] sm:w-[409px]">
            <Search className="size-[14px] text-v2-ink-70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Products"
              className="min-w-0 flex-1 bg-transparent font-inter-tight text-[15px] leading-[1.41] text-v2-ink outline-none placeholder:text-v2-ink-70"
            />
          </label>
          <div
            role="tablist"
            aria-label="Product source"
            className="flex gap-[11px] rounded-[34px] bg-v2-surface px-4 py-2"
          >
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "flex h-7 items-center rounded-[50px] border-[0.7px] px-3 font-inter-tight text-sm font-medium tracking-[0.28px] transition-opacity",
                  filter === f.value
                    ? "border-black bg-black text-white night:border-transparent night:bg-v2-active night:text-white"
                    : "border-black/60 text-[#616161] opacity-45 hover:opacity-80 night:border-v2-border night:text-v2-ink-60",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className={cn(
              pillClass("primary", "ml-auto h-[49.88px]"),
              "bg-none bg-black/70 hover:bg-black/80 night:bg-v2-blue",
            )}
          >
            Add Product
          </button>
        </div>

        {isLoading ? null : visible.length ? (
          <div className="grid grid-cols-2 gap-x-[22px] gap-y-[60px] md:grid-cols-3 xl:grid-cols-4">
            {visible.map((product) => (
              <ProductTile key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-[18px] bg-v2-surface px-6 py-16 text-center">
            <p className="font-archivo text-xl font-medium text-v2-ink">
              {products.length ? "No products match" : "No products yet"}
            </p>
            <p className="max-w-[360px] font-inter-tight text-sm text-v2-muted">
              {products.length
                ? "Try another search or filter."
                : "Add a product by link or upload, or connect Shopify to import your whole catalogue."}
            </p>
            {products.length ? null : (
              <div className="flex gap-3">
                <PillButton onClick={() => setAddOpen(true)}>Add Product</PillButton>
                <Link to="/connect" className={pillClass("outline")}>
                  Connect Shopify
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <AddProductDialog open={addOpen} onOpenChange={setAddOpen} />
    </AppShell>
  );
}

/** Product card; on hover it doubles as a launchpad into each studio (wireframe idea). */
function ProductTile({ product }: { product: Product }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-[12px] bg-v2-surface">
      <div className="relative aspect-[244/194] overflow-hidden rounded-[12px]">
        <img src={product.imageUrl} alt="" className="size-full object-cover" />
        <div className="absolute inset-0 flex items-end justify-center gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {[
            { to: "/photo-studio", label: "Photo" },
            { to: "/ad-studio", label: "Ad" },
            { to: "/video-studio", label: "Video" },
          ].map((studio) => (
            <Link
              key={studio.to}
              to={studio.to}
              className="rounded-full bg-white/95 px-3 py-1 font-archivo text-xs text-[#12213d] hover:bg-white"
            >
              Make {studio.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-[14px] py-[15px]">
        <p className="truncate font-archivo text-sm font-medium leading-archivo tracking-[-0.28px] text-black night:text-v2-ink">
          {product.name}
        </p>
        <SourceBadge source={product.source} />
      </div>
    </div>
  );
}

type AddTab = "url" | "manual" | "shopify";

/** Add Product popup (Figma 543:87468): Product URL, Manual or Shopify. */
function AddProductDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const add = useAddProduct();
  const [tab, setTab] = useState<AddTab>("url");
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState<Omit<Product, "id" | "createdAt"> | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setUrl("");
    setDraft(null);
    setName("");
    setDescription("");
    setImage(null);
    setTab("url");
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const runImport = async () => {
    let parsed: URL;
    try {
      parsed = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
    } catch {
      toast.error("That doesn't look like a product link.");
      return;
    }
    setImporting(true);
    try {
      setDraft(await importProductFromUrl(parsed.toString()));
    } catch {
      toast.error("We couldn't read that page.");
    } finally {
      setImporting(false);
    }
  };

  const manualDraft =
    name.trim() && image
      ? {
          name: name.trim(),
          description: description.trim(),
          imageUrl: image,
          source: "upload" as const,
        }
      : null;
  const ready = tab === "url" ? draft : tab === "manual" ? manualDraft : null;

  const save = () => {
    if (!ready) return;
    add.mutate(ready, {
      onSuccess: (product) => {
        toast.success(`${product.name} added`);
        close(false);
      },
    });
  };

  const tabs: { value: AddTab; label: string }[] = [
    { value: "url", label: "Product URL" },
    { value: "manual", label: "Manual" },
    { value: "shopify", label: "Shopify" },
  ];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        hideClose
        className="w-[622px] max-w-[calc(100vw-24px)] gap-0 rounded-[12px] border-none bg-v2-surface p-6 text-v2-ink shadow-[0_0_44.2px_rgba(0,0,0,0.08)] sm:max-w-[622px]"
      >
        <div className="flex items-start justify-between">
          {/* Figma: "Add Products" — the popup adds one product at a time. */}
          <DialogTitle className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px]">
            Add Product
          </DialogTitle>
          <button
            type="button"
            aria-label="Close"
            onClick={() => close(false)}
            className="-m-1.5 rounded-full p-1.5 hover:bg-v2-canvas"
          >
            <img src={closeIcon} alt="" className="size-[14px]" />
          </button>
        </div>

        <div role="tablist" aria-label="How to add" className="mt-5 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "rounded-[74px] px-[14px] py-2 font-archivo text-sm font-medium leading-archivo tracking-[-0.56px]",
                tab === t.value
                  ? "bg-v2-pill text-v2-pill-ink"
                  : "border-[0.8px] border-[rgba(12,43,96,0.18)] bg-v2-surface text-black/50 night:border-v2-border night:text-v2-ink-60",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "url" ? (
          <div className="mt-[54px] flex flex-col gap-[23px]">
            <div className="flex flex-col gap-2.5">
              <p className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px]">
                Paste a product page link
              </p>
              <form
                className="flex gap-[17px]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void runImport();
                }}
              >
                <label className="flex h-[43px] flex-1 items-center gap-2.5 rounded-[44px] border-[0.8px] border-black/[0.17] px-[15px] night:border-v2-border">
                  <Search className="size-[14px] text-black/50 night:text-v2-ink-60" />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    inputMode="url"
                    placeholder="https://yourstore.com/products/…"
                    className="min-w-0 flex-1 bg-transparent font-inter-tight text-sm tracking-[-0.56px] outline-none placeholder:text-black/50 night:placeholder:text-v2-ink-60"
                  />
                </label>
                <PillButton type="submit" disabled={!url.trim() || importing}>
                  {importing ? <Loader2 className="size-4 animate-spin" /> : null}
                  Import
                </PillButton>
              </form>
            </div>
            <div className="flex min-h-[201px] items-center gap-5 rounded-[14px] bg-[#f5f5f5] p-[21px] night:bg-v2-surface-2">
              {draft ? (
                <>
                  <img
                    src={draft.imageUrl}
                    alt=""
                    className="h-[159px] w-[145px] shrink-0 rounded-[8px] object-cover"
                  />
                  <div className="flex h-[159px] flex-1 flex-col gap-3 rounded-[8px] bg-v2-surface p-5">
                    <p className="font-inter-tight text-base font-medium text-v2-ink">
                      {draft.name}
                    </p>
                    <p className="line-clamp-4 type-subtitle text-v2-ink-70">{draft.description}</p>
                  </div>
                </>
              ) : (
                <p className="w-full text-center font-inter-tight text-sm text-v2-muted">
                  {importing ? "Reading the product page…" : "The product preview appears here."}
                </p>
              )}
            </div>
          </div>
        ) : null}

        {tab === "manual" ? (
          <div className="mt-8 flex gap-5">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex h-[180px] w-[160px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-black/20 bg-[#f5f5f5] font-inter-tight text-xs text-v2-muted night:border-v2-border night:bg-v2-surface-2"
            >
              {image ? (
                <img src={image} alt="" className="size-full object-cover" />
              ) : (
                "Add product image"
              )}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) setImage(URL.createObjectURL(file));
              }}
            />
            <div className="flex flex-1 flex-col gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Product name"
                aria-label="Product name"
                className="h-[43px] rounded-[44px] border-[0.8px] border-black/[0.17] bg-transparent px-[15px] font-inter-tight text-sm outline-none night:border-v2-border"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description (who it's for, what makes it special)"
                aria-label="Description"
                className="h-[125px] resize-none rounded-[14px] border-[0.8px] border-black/[0.17] bg-transparent px-[15px] py-3 font-inter-tight text-sm outline-none night:border-v2-border"
              />
            </div>
          </div>
        ) : null}

        {tab === "shopify" ? (
          <div className="mt-8 flex flex-col items-start gap-4 rounded-[14px] bg-[#f5f5f5] p-6 night:bg-v2-surface-2">
            <p className="font-archivo text-xl font-medium leading-archivo">
              Import your whole Shopify catalogue
            </p>
            <p className="font-inter-tight text-sm text-v2-muted">
              Connect your store through the Replix Shopify app. Products stay in sync
              automatically.
            </p>
            <Link to="/connect" onClick={() => close(false)} className={pillClass("primary")}>
              Connect Shopify
            </Link>
          </div>
        ) : null}

        {tab !== "shopify" ? (
          <div className="mt-[18px] flex justify-end gap-[15px]">
            <PillButton
              variant="outline"
              className="opacity-60 hover:opacity-100"
              onClick={() => close(false)}
            >
              Cancel
            </PillButton>
            <PillButton disabled={!ready || add.isPending} onClick={save}>
              Add Product
            </PillButton>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
