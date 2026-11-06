import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { PRICING_PLANS } from "@/lib/pricing-plans";
import { pillClass } from "@/v2/components/primitives";
import { ProfileMenu } from "./ProfileMenu";
import { Sidebar, SidebarContent } from "./Sidebar";
import creditCoin from "@/assets/v2/credit-coin.png";
import defaultAvatar from "@/assets/v2/home/avatar.png";
import logoMark from "@/assets/v2/logo-mark.png";

function useAccountSummary() {
  const { user } = useAuth();
  const { credits, plan, loading } = useCredits();
  const planInfo = PRICING_PLANS.find((p) => p.key === plan) ?? PRICING_PLANS[0];
  return {
    planInfo,
    loading,
    remaining: Math.max(0, credits),
    avatar: (user?.user_metadata?.avatar_url as string | undefined) ?? defaultAvatar,
  };
}

function Avatar({ size = 40 }: { size?: number }) {
  const { avatar } = useAccountSummary();
  return (
    <ProfileMenu
      trigger={
        <button
          type="button"
          aria-label="Open account menu"
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-blue/40"
        >
          <img
            src={avatar}
            alt=""
            width={size}
            height={size}
            className="rounded-full object-cover"
            style={{ width: size, height: size }}
          />
        </button>
      }
    />
  );
}

/** Phone and tablet header: menu, logo, credit count and avatar on one row. */
function CompactCredits() {
  const { planInfo, remaining, loading } = useAccountSummary();
  return (
    <Link
      to="/upgrade"
      aria-label={`${remaining} of ${planInfo.ads} credits left on the ${planInfo.name} plan`}
      className="flex h-9 items-center gap-1.5 rounded-full bg-v2-surface px-3 shadow-sm"
    >
      <img src={creditCoin} alt="" className="size-[18px]" />
      <span className="font-archivo text-[15px] font-medium tabular-nums text-v2-ink">
        {loading ? "–" : `${remaining}/${planInfo.ads}`}
      </span>
    </Link>
  );
}

function CreditsCard() {
  const { planInfo, remaining, loading } = useAccountSummary();

  return (
    <div className="flex items-center gap-2.5 rounded-[36px] bg-v2-panel px-[15px] py-2 night:border-[0.6px] night:border-white/35 drop-shadow-[0px_1px_4.3px_rgba(0,0,0,0.03)]">
      <Link
        to="/upgrade"
        aria-label={`${remaining} of ${planInfo.ads} credits left on the ${planInfo.name} plan`}
        className="flex h-[41px] w-[185px] items-center justify-center rounded-[41px] border border-black/[0.04] bg-v2-surface px-2 py-1 drop-shadow-[0px_0px_14.75px_rgba(0,0,0,0.03)] night:border-transparent night:bg-white/20"
      >
        <span className="flex w-[156px] items-center justify-between">
          <span className="flex items-center gap-[9px]">
            <img src={creditCoin} alt="" className="size-5 object-cover" />
            <span className="font-archivo text-lg font-medium leading-[1.4] tabular-nums text-black night:text-v2-ink">
              {loading ? "–" : `${remaining}/${planInfo.ads}`}
            </span>
          </span>
          <span className="rounded-[15px] bg-v2-cream px-2.5 py-1.5 font-jakarta text-xs font-medium leading-[1.26] text-black/60 night:text-v2-ink-70">
            {planInfo.name}
          </span>
        </span>
      </Link>
      <Avatar />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="type-page-title text-v2-ink">{title}</h1>
        {subtitle ? <p className="type-subtitle text-v2-ink-70">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-[14px]">
        {actions}
        <div className="hidden items-center gap-[14px] lg:flex">
          <Link to="/upgrade" className={pillClass("primary", "h-[57px]")}>
            Upgrade
          </Link>
          <CreditsCard />
        </div>
      </div>
    </div>
  );
}

/**
 * Frame for every signed-in 2.0 screen: 308px sidebar, dotted canvas, and a content
 * column that starts 52px from the sidebar (1042px wide at the 1440 design size).
 */
export function AppShell({
  title,
  subtitle,
  actions,
  children,
  contentClassName,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="v2-canvas flex min-h-screen w-full font-inter-tight text-v2-ink">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex items-center gap-3 bg-v2-canvas/85 px-4 py-3 backdrop-blur sm:px-8 lg:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger
              className="flex size-10 items-center justify-center rounded-full bg-v2-surface text-v2-ink shadow-sm"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[308px] max-w-[85vw] overflow-y-auto rounded-r-[40px] border-none bg-v2-panel p-0 sm:max-w-[308px]"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/dashboard" aria-label="Replix AI home" className="shrink-0">
            <img src={logoMark} alt="" className="size-8 rounded-[5px]" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <CompactCredits />
            <Avatar size={36} />
          </div>
        </div>
        <main
          className={cn(
            "mx-auto w-full max-w-[1480px] px-4 pb-16 pt-3 sm:px-8 lg:pb-24 lg:pl-[52px] lg:pr-[38px] lg:pt-[44px]",
            contentClassName,
          )}
        >
          <PageHeader title={title} subtitle={subtitle} actions={actions} />
          {children}
        </main>
      </div>
    </div>
  );
}
