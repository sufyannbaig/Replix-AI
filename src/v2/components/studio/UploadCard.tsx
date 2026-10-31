import { Link } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type UploadedImage = { name: string; url: string; isVideo?: boolean };

/** Big upload card for custom mode; shows the chosen image once uploaded. */
export function UploadCard({
  title,
  subtitle,
  button,
  art,
  value,
  onChange,
  acceptVideo = false,
}: {
  title: string;
  subtitle: string;
  button: string;
  art: ReactNode;
  value: UploadedImage | null;
  onChange: (value: UploadedImage | null) => void;
  /** Accept videos as well as images (motion references). */
  acceptVideo?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="relative flex h-[375px] flex-col items-center justify-end overflow-hidden rounded-[14px] bg-v2-surface pb-[41px]">
      {value ? (
        <img src={value.url} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        art
      )}
      <div
        className={cn(
          "relative flex flex-col items-center gap-3",
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
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-[35px] border-[0.6px] border-[#a2a2a2] bg-white px-5 py-2.5 font-archivo text-base leading-[1.4] text-black hover:bg-[#f5f5f5]"
          >
            <Upload className="size-4" />
            {value ? "Replace" : button}
          </button>
          {/* Wireframe: each slot can also pull from the user's Library. */}
          <Link
            to="/library"
            className="font-inter-tight text-xs text-v2-muted underline-offset-2 hover:underline"
          >
            or pick from Library
          </Link>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={
          acceptVideo
            ? "image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
            : "image/png,image/jpeg,image/webp"
        }
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file)
            onChange({
              name: file.name,
              url: URL.createObjectURL(file),
              isVideo: file.type.startsWith("video/"),
            });
        }}
      />
    </div>
  );
}
