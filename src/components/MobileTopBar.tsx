import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Sparkles,
  Images,
  CreditCard,
  LogOut,
  Zap,
  FolderKanban,
  HelpCircle,
  Menu,
} from "lucide-react";
import logoAsset from "@/assets/replix-mark.png.asset.json";
const logo = logoAsset.url;
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/create", label: "Generate Ads", icon: Sparkles },
  { to: "/gallery", label: "Ad Gallery", icon: Images },
  { to: "/collections", label: "Collections", icon: FolderKanban },
  { to: "/pricing", label: "Pricing", icon: CreditCard },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/help", label: "Help", icon: HelpCircle },
] as const;

export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const { location } = useRouterState();
  const pathname = location.pathname;
  const { user, signOut } = useAuth();
  const { credits, plan } = useCredits();

  const email = user?.email ?? "";
  const initial = (email[0] ?? "U").toUpperCase();
  const displayName = email.split("@")[0] || "Account";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar/95 text-sidebar-foreground px-4 py-3 backdrop-blur lg:hidden">
      <Link to="/dashboard" className="flex items-center gap-2">
        <img src={logo} alt="Replix AI" className="h-8 w-8 rounded-lg object-contain" />
        <span className="font-display text-base font-bold tracking-tight">Replix AI</span>
      </Link>

      <div className="flex items-center gap-2">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-1.5 text-xs font-semibold text-navy shadow-soft"
        >
          <Zap className="size-3.5" />
          {credits}
        </Link>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className="grid size-9 place-items-center rounded-lg border border-sidebar-border text-sidebar-foreground"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Main navigation menu
            </SheetDescription>

            <div className="flex h-full flex-col">
              <div className="flex items-center gap-3 px-5 py-5">
                <img src={logo} alt="Replix AI" className="h-9 w-9 rounded-lg object-contain" />
                <div className="leading-tight">
                  <div className="font-display text-base font-bold tracking-tight">Replix AI</div>
                  <div className="text-xs text-sidebar-foreground/70">for Shopify</div>
                </div>
              </div>

              <nav className="flex-1 space-y-1 px-3">
                {nav.map((item) => {
                  const isActive =
                    pathname === item.to || pathname.startsWith(item.to + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mx-3 mb-3 mt-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex min-w-0 items-center gap-2 text-xs font-medium text-sidebar-foreground/80">
                    <Zap className="size-3.5 shrink-0 text-signal" /> Credits
                  </div>
                  <span className="shrink-0 rounded-md bg-signal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-foreground">
                    {plan}
                  </span>
                </div>
                <div className="mt-1 font-display text-2xl font-bold text-sidebar-foreground">{credits}</div>
                <Link
                  to="/pricing"
                  onClick={() => setOpen(false)}
                  className="mt-1 inline-block text-xs font-semibold text-signal hover:underline"
                >
                  Get more →
                </Link>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-sidebar-border px-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-gold-soft">
                    {initial}
                  </div>
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-sm font-semibold capitalize">{displayName}</div>
                    <div className="truncate text-xs text-sidebar-foreground/70">{email}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
