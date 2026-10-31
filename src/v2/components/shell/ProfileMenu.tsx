import { Link, useNavigate } from "@tanstack/react-router";
import { Moon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { PRICING_PLANS } from "@/lib/pricing-plans";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/v2/components/Icon";
import { useThemePreference, type ThemePreference } from "@/v2/theme";
import signoutDoor from "@/assets/v2/icons/signout-door.svg";
import signoutArrow from "@/assets/v2/icons/signout-arrow.svg";
import defaultAvatar from "@/assets/v2/home/avatar.png";

const rowText = "font-archivo text-sm font-medium leading-archivo tracking-[-0.28px] text-v2-ink";

function MenuLink({
  to,
  icon,
  iconSize,
  children,
  onNavigate,
}: {
  to: string;
  icon: IconName;
  iconSize: [number, number];
  children: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        rowText,
        "-mx-2 flex items-center gap-5 rounded-lg px-2 py-1.5 hover:bg-v2-canvas",
      )}
    >
      <span className="flex size-4 items-center justify-center">
        <Icon name={icon} width={iconSize[0]} height={iconSize[1]} className="text-v2-ink" />
      </span>
      {children}
    </Link>
  );
}

const APPEARANCE: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function AppearanceToggle() {
  const { preference, setPreference } = useThemePreference();
  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="flex w-[116px] items-center justify-between rounded-[31px] border border-black/[0.04] bg-[#1f55ae] px-[14px] py-[7px] drop-shadow-[0_0_11.2px_rgba(0,0,0,0.04)]"
    >
      {APPEARANCE.map((option) => {
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => setPreference(option.value)}
            className={cn(
              "flex size-[18px] items-center justify-center text-white transition-opacity",
              active ? "opacity-100" : "opacity-45 hover:opacity-80",
            )}
          >
            {option.value === "light" ? <Icon name="sun" width={15.75} /> : null}
            {/* Figma repeats the sun for Dark; a moon reads correctly. */}
            {option.value === "dark" ? <Moon className="size-[15px]" strokeWidth={1.6} /> : null}
            {option.value === "system" ? <Icon name="monitor" width={14} height={12} /> : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Profile popup (Figma 543:168303): identity, credits, upgrade push, Refer & Earn,
 * appearance, settings, help and sign out.
 */
export function ProfileMenu({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { credits, plan } = useCredits();
  const close = () => setOpen(false);

  const planInfo = PRICING_PLANS.find((p) => p.key === plan) ?? PRICING_PLANS[0];
  const free = PRICING_PLANS.find((p) => p.key === "free");
  const pro = PRICING_PLANS.find((p) => p.key === "pro");
  const multiplier = free && pro ? Math.round(pro.ads / free.ads) : null;
  const remaining = Math.max(0, credits);
  const remainingShare = Math.min(1, remaining / Math.max(1, planInfo.ads));

  const meta = user?.user_metadata ?? {};
  const name =
    ((meta.full_name ?? meta.name) as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Your account";
  const avatar = (meta.avatar_url as string | undefined) ?? defaultAvatar;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={14}
        className="w-[342px] max-w-[calc(100vw-24px)] rounded-[10px] border-none bg-v2-surface p-[22px] text-v2-ink shadow-[0_0_23.6px_rgba(0,0,0,0.07)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={avatar} alt="" className="size-[50px] shrink-0 rounded-full object-cover" />
            <div className="flex min-w-0 flex-col gap-[3px]">
              <p className={cn(rowText, "truncate")}>{name}</p>
              <p className="truncate font-inter-tight text-xs text-v2-muted opacity-75">
                {user?.email}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-[15px] bg-[#1f55ae] px-2.5 py-1.5 font-jakarta text-xs font-medium leading-[1.26] text-white">
            {planInfo.name} plan
          </span>
        </div>

        <div className="my-[19px] h-px bg-v2-line" />

        <MenuLink to="/settings" icon="edit" iconSize={[14, 14.34]} onNavigate={close}>
          Edit Profile
        </MenuLink>

        <div className="mt-[18px] flex flex-col gap-2.5">
          <div className="rounded-[8px] bg-[#f5f5f5] p-4 night:bg-v2-surface-2">
            <p className={rowText}>
              {remaining} / {planInfo.ads} credits
            </p>
            <div className="mt-[11px] h-[7px] overflow-hidden rounded-[26px] bg-white night:bg-v2-canvas">
              <div
                className="h-full rounded-[26px] bg-[#374c74] night:bg-v2-blue"
                style={{ width: `${remainingShare * 100}%` }}
              />
            </div>
            <p className="mt-2.5 font-inter-tight text-xs text-[#565454] opacity-75 night:text-v2-muted">
              {plan === "free" ? "One-time free credits" : "Resets on the 1st"}
            </p>
          </div>

          {plan !== "scale" ? (
            <div className="flex items-center justify-between rounded-[8px] bg-[linear-gradient(102.95deg,rgb(255,235,201)_0.24%,rgba(193,214,255,0.6)_99.77%)] p-4">
              <div className="flex w-[148px] flex-col gap-1.5 text-[#12213d]">
                <p className="font-archivo text-base font-medium leading-archivo tracking-[-0.32px]">
                  {multiplier && plan === "free"
                    ? `Get ${multiplier}× more credits`
                    : "Get more credits"}
                </p>
                <p className="font-inter-tight text-xs opacity-80">and every premium template</p>
              </div>
              <Link
                to="/upgrade"
                onClick={close}
                className="rounded-[60px] bg-white px-4 py-2 font-archivo text-xs font-medium leading-[1.4] text-[#374c74] hover:bg-white/80"
              >
                Upgrade
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-[18px] flex flex-col gap-[14px]">
          <MenuLink to="/refer" icon="link" iconSize={[16, 16]} onNavigate={close}>
            Refer &amp; Earn
          </MenuLink>
          <div className="flex items-center justify-between">
            <span className={rowText}>Appearance</span>
            <AppearanceToggle />
          </div>
          <MenuLink to="/settings" icon="settings" iconSize={[16, 16]} onNavigate={close}>
            Settings
          </MenuLink>
          <MenuLink to="/help" icon="help" iconSize={[14.65, 16]} onNavigate={close}>
            Help &amp; Support
          </MenuLink>
        </div>

        <div className="my-[14px] h-px bg-v2-line" />

        <button
          type="button"
          onClick={async () => {
            close();
            await signOut();
            navigate({ to: "/login" });
          }}
          className={cn(
            rowText,
            "-mx-2 flex w-[calc(100%+16px)] items-center gap-5 rounded-lg px-2 py-1.5 hover:bg-v2-canvas",
          )}
        >
          <span className="relative size-4">
            <img src={signoutDoor} alt="" className="absolute left-0 top-0 h-4 w-[7.83px]" />
            <img
              src={signoutArrow}
              alt=""
              className="absolute left-[4.18px] top-[2.8px] h-[10.4px] w-[11.83px]"
            />
          </span>
          Sign Out
        </button>
      </PopoverContent>
    </Popover>
  );
}
