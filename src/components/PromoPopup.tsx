"use client";

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift, ArrowRight, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "replix.promoPopupShown";
const DELAY_MS = 4000;

export function PromoPopup() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (loading) return;
    if (user) return;

    try {
      const alreadyShown = window.localStorage.getItem(STORAGE_KEY);
      if (alreadyShown) return;
    } catch {
      // ignore storage errors
    }

    const timer = setTimeout(() => {
      setOpen(true);
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, [hydrated, loading, user]);

  // Prevent SSR/hydration mismatch by not rendering until client-side
  if (!hydrated || loading || user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md overflow-hidden border-navy/20 bg-card p-0 sm:rounded-2xl">
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-2 brand-gradient" />
          <div className="absolute -right-16 -top-16 size-40 rounded-full bg-gold/15 blur-3xl" />
          <div className="absolute -left-10 -bottom-10 size-32 rounded-full bg-navy-bright/15 blur-3xl" />

          <div className="relative px-6 pb-6 pt-8">
            <div className="mb-4 flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-navy">
                <Sparkles className="size-3" /> Exclusive · Free Offer
              </span>
            </div>

            <DialogHeader className="text-center">
              <DialogTitle className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                10 FREE AI ads
                <span className="block brand-gradient-text">no card required</span>
              </DialogTitle>
              <DialogDescription className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
                Claim your free launch plan and get 10 AI-generated ads. No card required.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
              >
                <Gift className="size-4" /> Claim 10 free ads <ArrowRight className="size-4" />
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="text-center text-xs text-muted-foreground transition hover:text-foreground"
              >
                No thanks, I’ll pay later
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
