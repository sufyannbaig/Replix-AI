import { Upload, X } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LibraryPicker } from "@/v2/components/studio/LibraryPicker";
import type { PieceKind } from "@/v2/data/types";

export type UploadedImage = { name: string; url: string; isVideo?: boolean };

const IMAGE_TYPES = "image/png,image/jpeg,image/webp";
const VIDEO_TYPES = "video/mp4,video/quicktime";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Three fanned sample cards above an upload prompt. */
export function StackArt({ images }: { images: [string, string, string] }) {
  const cards = [
    { src: images[0], className: "left-[100px] top-[12px] rotate-[7.6deg]" },
    { src: images[1], className: "left-[52px] top-[4px]" },
    { src: images[2], className: "left-[4px] top-[8px] -rotate-[9.8deg]" },
  ];
  return (
    <span aria-hidden className="absolute left-[calc(50%-102px)] top-[44px] h-[150px] w-[204px]">
      {cards.map((card) => (
        <img
          key={card.src}
          src={card.src}
          alt=""
          className={cn(
            "absolute h-[132px] w-[100px] rounded-[8px] border-2 border-white object-cover shadow-[0_6px_18px_rgba(0,0,0,0.12)] night:border-v2-surface-2",
            card.className,
          )}
        />
      ))}
    </span>
  );
}

/** Short guidance under an upload card. */
export function UploadTip({ children }: { children: string }) {
  return (
    <p className="px-1 font-inter-tight text-xs leading-[1.4] text-v2-muted">
      <span className="font-medium text-v2-ink-70">Tip:</span> {children}
    </p>
  );
}

/**
 * Big upload card for custom modes; shows the chosen image once there is one. Drag & drop
 * works too, and `libraryKind` adds a real "pick from Library" popup.
 */
export function UploadCard({
  title,
  subtitle,
  button,
  art,
  value,
  onChange,
  acceptVideo = false,
  libraryKind,
}: {
  title: string;
  subtitle: string;
  button: string;
  art: ReactNode;
  value: UploadedImage | null;
  onChange: (value: UploadedImage | null) => void;
  /** Accept videos as well as images (motion references). */
  acceptVideo?: boolean;
  /** Which Library section "pick from Library" opens. Leave out when there's nothing to pick. */
  libraryKind?: PieceKind;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined) => {
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    if (!(file.type.startsWith("image/") || (acceptVideo && isVideo))) {
      toast.error(
        acceptVideo ? "Use a PNG, JPG, WEBP, MP4 or MOV file." : "Use a PNG, JPG or WEBP image.",
      );
      return;
    }
    if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
      toast.error(isVideo ? "That video is over 100 MB." : "That image is over 10 MB.");
      return;
    }
    onChange({ name: file.name, url: URL.createObjectURL(file), isVideo });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "relative flex h-[375px] flex-col items-center justify-end overflow-hidden rounded-[14px] bg-v2-surface pb-8 transition-shadow",
        dragging && "ring-2 ring-v2-selected",
      )}
    >
      {value ? (
        value.isVideo ? (
          <video
            src={value.url}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <img src={value.url} alt="" className="absolute inset-0 size-full object-cover" />
        )
      ) : (
        art
      )}
      {value ? (
        <button
          type="button"
          aria-label={`Remove ${value.name}`}
          onClick={() => onChange(null)}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-white/90 text-[#12213d] shadow-sm hover:bg-white"
        >
          <X className="size-4" />
        </button>
      ) : null}
      <div
        className={cn(
          "relative flex max-w-[calc(100%-24px)] flex-col items-center gap-3",
          value && "rounded-[14px] bg-white/90 px-5 py-3",
        )}
      >
        {value ? (
          <p className="max-w-[260px] truncate font-archivo text-base font-medium text-[#12213d]">
            {value.name}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <p className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px] text-v2-ink">
              {title}
            </p>
            <p className="font-inter-tight text-sm text-v2-muted">{subtitle}</p>
          </div>
        )}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-[35px] border-[0.6px] border-[#a2a2a2] bg-white px-5 py-2.5 font-archivo text-base leading-[1.4] text-black hover:bg-[#f5f5f5]"
          >
            <Upload className="size-4" />
            {value ? "Replace" : button}
          </button>
          {libraryKind ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={cn(
                "font-inter-tight text-xs underline underline-offset-2 hover:text-v2-ink",
                value ? "text-[#12213d]/70 hover:text-[#12213d]" : "text-v2-muted",
              )}
            >
              or pick from Library
            </button>
          ) : (
            <span
              className={cn(
                "font-inter-tight text-xs",
                value ? "text-[#12213d]/70" : "text-v2-muted",
              )}
            >
              or drag & drop a file here
            </span>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={acceptVideo ? `${IMAGE_TYPES},${VIDEO_TYPES}` : IMAGE_TYPES}
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {libraryKind ? (
        <LibraryPicker
          kind={libraryKind}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(piece) => onChange({ name: piece.name, url: piece.imageUrl })}
        />
      ) : null}
    </div>
  );
}
