import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PillButton } from "@/v2/components/primitives";
import { setConsentHost } from "@/v2/data/consent";

/**
 * The "I have this person's permission" step shown before a character photo is uploaded.
 * Mounted once in the app shell; opened through `askPersonConsent()`.
 */
export function PersonConsentHost() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const answer = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    setConsentHost((resolve) => {
      /* A second request while one is open: the first is treated as cancelled. */
      answer.current?.(false);
      answer.current = resolve;
      setChecked(false);
      setOpen(true);
    });
    return () => {
      setConsentHost(null);
      answer.current?.(false);
      answer.current = null;
    };
  }, []);

  const finish = (ok: boolean) => {
    answer.current?.(ok);
    answer.current = null;
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : finish(false))}>
      <DialogContent
        hideClose
        className="w-[440px] max-w-[calc(100vw-24px)] gap-0 rounded-[12px] border-none bg-v2-surface p-6 text-v2-ink shadow-[0_0_44.2px_rgba(0,0,0,0.08)] sm:max-w-[440px]"
      >
        <DialogTitle className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px] text-v2-ink">
          Is this a real person?
        </DialogTitle>
        <DialogDescription className="mt-1 font-inter-tight text-xs text-v2-muted">
          Photos and videos made with this character will show their face. Only upload someone who
          has agreed to that. Don't upload celebrities or other public figures.
        </DialogDescription>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[8px] bg-v2-canvas p-3 font-inter-tight text-sm text-v2-ink">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[#124498]"
          />
          <span>I have this person's permission to use their photo, or this is me.</span>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <PillButton variant="outline" onClick={() => finish(false)}>
            Cancel
          </PillButton>
          <PillButton disabled={!checked} onClick={() => finish(true)}>
            Upload
          </PillButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
