import { Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PillButton, pillClass } from "@/v2/components/primitives";
import { useProducts, useUploadProduct } from "@/v2/data/api";
import type { Product } from "@/v2/data/types";
import closeIcon from "@/assets/v2/icons/close.svg";
import searchIcon from "@/assets/v2/icons/search.svg";
import stackBack from "@/assets/v2/gallery/d726d.png";
import stackMiddle from "@/assets/v2/gallery/d1471.png";
import stackFront from "@/assets/v2/gallery/908f4.png";

type Tab = "all" | "shopify" | "recent";

const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "Your Products" },
  { value: "shopify", label: "Shopify" },
  { value: "recent", label: "Recent Uploads" },
];

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** The little product stack above every upload prompt (Figma 543:160456). */
function UploadArt() {
  return (
    <span aria-hidden className="relative block h-[73px] w-[101px]">
      <img
        src={stackBack}
        alt=""
        className="absolute left-[62px] top-[25px] size-[39px] rounded-[4px] object-cover"
      />
      <img
        src={stackMiddle}
        alt=""
        className="absolute left-[34px] top-0 size-12 rounded-[8px] object-cover"
      />
      <img
        src={stackFront}
        alt=""
        className="absolute left-0 top-[10px] size-12 rounded-[4px] object-cover"
      />
    </span>
  );
}

function UploadZone({
  large,
  onFile,
  busy,
}: {
  large: boolean;
  onFile: (file: File) => void;
  busy: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      toast.error("Use a PNG, JPG or WEBP image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("That image is over 10 MB.");
      return;
    }
    onFile(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files?.[0]);
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-[9px] rounded-[12px] border border-dashed border-black/20 bg-[#f5f5f5] transition-colors night:border-v2-border night:bg-v2-surface-2",
        large ? "h-[305px]" : "h-[161px]",
        dragging && "border-v2-blue bg-v2-nav-active",
      )}
    >
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <UploadArt />
      <span className="flex flex-col items-center gap-2">
        <span
          className={cn(
            "font-archivo font-medium leading-archivo text-[#212121] night:text-v2-ink",
            large ? "text-base" : "text-sm",
          )}
        >
          {busy ? "Uploading…" : large ? "Upload Your Product Image" : "Upload image · drag & drop"}
        </span>
        <span className={cn("font-inter-tight text-v2-muted", large ? "text-xs" : "text-[10px]")}>
          {large ? "Drag & drop, or click to browse · PNG or JPG" : "PNG or JPG"}
        </span>
      </span>
    </button>
  );
}

/**
 * Shared Product Picker (Read-me rule: one popup for Photo, Ad and Video studios).
 * State A: the user has products, so they come first and upload sits below.
 * State B: nothing yet, so one large upload area plus a Shopify nudge.
 */
export function ProductPicker({
  open,
  onOpenChange,
  onSelect,
  initialSelectedId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: Product) => void;
  initialSelectedId?: string;
}) {
  const { data: products = [], isLoading } = useProducts();
  const upload = useUploadProduct();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialSelectedId);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter(
        (p) =>
          tab === "all" || (tab === "shopify" ? p.source === "shopify" : p.source === "upload"),
      )
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => (tab === "recent" ? b.createdAt.localeCompare(a.createdAt) : 0));
  }, [products, tab, query]);

  const empty = !isLoading && products.length === 0;
  const selected = products.find((p) => p.id === selectedId);

  const choose = (product: Product) => {
    onSelect(product);
    onOpenChange(false);
  };

  const handleFile = (file: File) =>
    upload.mutate(file, {
      onSuccess: (product) => {
        setSelectedId(product.id);
        toast.success(`${product.name} added`);
      },
      onError: () => toast.error("Upload failed. Please try again."),
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="w-[622px] max-w-[calc(100vw-24px)] gap-0 rounded-[12px] border-none bg-v2-surface p-6 text-v2-ink shadow-[0_0_44.2px_rgba(0,0,0,0.08)] sm:max-w-[622px]"
      >
        <div className="flex items-start justify-between">
          <DialogTitle className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px] text-v2-ink">
            Add Products
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="-m-1.5 rounded-full p-1.5 hover:bg-v2-canvas"
          >
            <img src={closeIcon} alt="" className="size-[14px]" />
          </button>
        </div>

        {empty ? (
          <>
            <div className="mt-[30px]">
              <UploadZone large onFile={handleFile} busy={upload.isPending} />
            </div>
            <p className="mt-[13px] font-inter-tight text-sm tracking-[-0.28px] text-[#212121]/60 night:text-v2-ink-60">
              No products yet? Connect your Shopify store to import them all.
            </p>
            <div className="mt-[13px] flex justify-end">
              <Link
                to="/connect"
                className={pillClass("outline")}
                onClick={() => onOpenChange(false)}
              >
                Connect Shopify
              </Link>
            </div>
          </>
        ) : (
          <>
            <div role="tablist" aria-label="Product source" className="mt-5 flex flex-wrap gap-2">
              {TABS.map((t) => {
                const active = t.value === tab;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.value)}
                    className={cn(
                      "rounded-[74px] px-[14px] py-2 font-archivo text-sm font-medium leading-archivo tracking-[-0.56px] transition-colors",
                      active
                        ? "bg-v2-pill text-v2-pill-ink"
                        : "border-[0.8px] border-[rgba(12,43,96,0.18)] bg-v2-surface text-black/50 hover:text-v2-ink night:border-v2-border night:text-v2-ink-60",
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 flex h-[41px] items-center gap-2.5 rounded-[7px] border-[0.8px] border-black/[0.17] px-4 night:border-v2-border">
              <span
                aria-hidden
                className="v2-icon size-[14px] text-black/50 night:text-v2-ink-60"
                style={{
                  maskImage: `url("${searchIcon}")`,
                  WebkitMaskImage: `url("${searchIcon}")`,
                }}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Products"
                className="min-w-0 flex-1 bg-transparent font-inter-tight text-sm tracking-[-0.56px] text-v2-ink outline-none placeholder:text-black/50 night:placeholder:text-v2-ink-60"
              />
            </label>

            {visible.length ? (
              <div className="mt-[21px] grid max-h-[300px] grid-cols-2 gap-x-[11px] gap-y-4 overflow-y-auto sm:grid-cols-4">
                {visible.map((product) => {
                  const active = product.id === selectedId;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setSelectedId(product.id)}
                      onDoubleClick={() => choose(product)}
                      aria-pressed={active}
                      className="group flex flex-col gap-3 text-left"
                    >
                      <span
                        className={cn(
                          "block aspect-[135/139] overflow-hidden rounded-[8px] border-[0.9px]",
                          active ? "border-black night:border-v2-ink" : "border-transparent",
                        )}
                      >
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      </span>
                      <span className="truncate font-inter-tight text-xs font-medium tracking-[0.24px] text-v2-ink">
                        {product.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-10 text-center font-inter-tight text-sm text-v2-muted">
                {tab === "shopify" ? (
                  <>
                    No Shopify products yet.{" "}
                    <Link to="/connect" className="underline" onClick={() => onOpenChange(false)}>
                      Connect your store
                    </Link>
                  </>
                ) : (
                  "No products match your search."
                )}
              </p>
            )}

            <div className="mt-[30px]">
              <UploadZone large={false} onFile={handleFile} busy={upload.isPending} />
            </div>

            {selected ? (
              <div className="mt-4 flex items-center justify-end gap-3">
                <span className="truncate font-inter-tight text-xs text-v2-muted">
                  {selected.name}
                </span>
                <PillButton onClick={() => choose(selected)}>Use product</PillButton>
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
