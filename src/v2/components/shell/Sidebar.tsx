import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Clapperboard, Images, PersonStanding, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/v2/components/Icon";
import { useBrandKits } from "@/v2/data/api";
import logoMark from "@/assets/v2/logo-mark.png";
import logoWordmark from "@/assets/v2/logo-wordmark.svg";
import brandKitRing from "@/assets/v2/icons/brandkit-ring.svg";

type NavIcon =
  | { kind: "figma"; name: IconName; width: number; height: number; flipY?: boolean }
  | { kind: "lucide"; Component: typeof Images };

type NavItem = { to: string; label: string; icon: NavIcon; search?: Record<string, string> };

type NavGroup = { id: string; label: string; items: NavItem[] };

const figma = (name: IconName, width: number, height: number, flipY = false): NavIcon => ({
  kind: "figma",
  name,
  width,
  height,
  flipY,
});

const PRIMARY: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: figma("home", 18, 18) },
  { to: "/assets", label: "Assets", icon: figma("assets", 16.95, 12.9, true) },
];

/*
 * Figma only shows Create and Brand expanded. Library and Connect follow the same item
 * pattern; their icons come from lucide at the same 18px size and stroke weight.
 */
const GROUPS: NavGroup[] = [
  {
    id: "create",
    label: "Create",
    items: [
      { to: "/photo-studio", label: "Photo Studio", icon: figma("photoStudio", 18, 15.78) },
      { to: "/ad-studio", label: "Ad Studio", icon: figma("adStudio", 14.62, 13.5) },
      { to: "/video-studio", label: "Video Studio", icon: figma("videoStudio", 16.31, 16.88) },
    ],
  },
  {
    id: "library",
    label: "Library",
    items: [
      {
        to: "/library",
        label: "Characters",
        icon: { kind: "lucide", Component: PersonStanding },
        search: { tab: "characters" },
      },
      {
        to: "/library",
        label: "Scenes",
        icon: { kind: "lucide", Component: Images },
        search: { tab: "scenes" },
      },
      {
        to: "/library",
        label: "Styles & Poses",
        icon: { kind: "lucide", Component: Clapperboard },
        search: { tab: "styles" },
      },
    ],
  },
  {
    id: "brand",
    label: "Brand",
    items: [
      { to: "/brand-kit", label: "Brand Kit", icon: figma("brandKit", 16, 16) },
      { to: "/products", label: "Products", icon: figma("products", 18, 18) },
    ],
  },
  {
    id: "connect",
    label: "Connect",
    items: [{ to: "/connect", label: "Shopify", icon: { kind: "lucide", Component: ShoppingBag } }],
  },
];

function NavGlyph({ icon }: { icon: NavIcon }) {
  return (
    <span className="flex size-[18px] shrink-0 items-center justify-center">
      {icon.kind === "figma" ? (
        <Icon
          name={icon.name}
          width={icon.width}
          height={icon.height}
          className={cn("text-v2-icon", icon.flipY && "-scale-y-100")}
        />
      ) : (
        <icon.Component className="size-[18px] text-v2-icon" strokeWidth={1.4} />
      )}
    </span>
  );
}

function NavRow({
  item,
  active,
  dimClass,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  dimClass: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={item.to}
      search={item.search}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-[49px] px-[19px] py-3 font-archivo text-base leading-archivo text-v2-ink transition-[background-color,opacity] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v2-blue/40",
        active ? "bg-v2-nav-active" : cn(dimClass, "hover:bg-v2-nav-active/60 hover:opacity-100"),
      )}
    >
      <NavGlyph icon={item.icon} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  );
}

function Divider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("h-0 w-[223px] border-t-[0.5px] border-v2-line", className)} />
  );
}

function useActiveMatcher() {
  const location = useRouterState({ select: (s) => s.location });
  return (item: NavItem) => {
    const onPath = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
    if (!onPath) return false;
    if (!item.search) return true;
    const search = location.search as Record<string, unknown>;
    const tab = typeof search.tab === "string" ? search.tab : "characters";
    return tab === item.search.tab;
  };
}

function BrandKitSwitcher() {
  const { data: kits } = useBrandKits();
  const kit = kits?.[0];
  if (!kit) return null;
  return (
    <Link
      to="/brand-kit"
      className="flex h-[42.75px] w-[215px] items-center justify-between rounded-full"
      aria-label={`Current brand kit: ${kit.name}`}
    >
      <span className="flex items-center gap-[13px]">
        <span className="relative size-9 shrink-0">
          <img src={brandKitRing} alt="" className="absolute -inset-[49.72%] max-w-none" />
          {kit.logoUrl ? (
            <img
              src={kit.logoUrl}
              alt=""
              className="absolute left-[7.36px] top-[10.64px] h-[14.73px] w-[20.45px] object-contain"
            />
          ) : null}
        </span>
        <span className="font-archivo text-sm font-medium text-v2-ink">{kit.name}</span>
      </span>
      <span className="relative h-[21.4px] w-[17px] shrink-0 rounded-[9px] bg-v2-blue">
        <Icon
          name="chevronSmallRight"
          width={10.07}
          className="absolute left-[3.5px] top-[5.66px] rotate-180 -scale-y-100 text-white"
        />
      </span>
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const isActive = useActiveMatcher();
  const activeGroup = GROUPS.find((g) => g.items.some(isActive))?.id;
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    activeGroup ? { [activeGroup]: true } : {},
  );
  const isOpen = (id: string) => open[id] ?? id === activeGroup;

  return (
    <div className="flex min-h-full flex-col pb-10">
      <Link
        to="/dashboard"
        onClick={onNavigate}
        className="ml-[38.19px] mt-[51.36px] flex h-[39.9px] items-center gap-[10.63px]"
        aria-label="Replix AI home"
      >
        <img src={logoMark} alt="" className="size-[39.9px] rounded-[6px] object-cover" />
        <span
          aria-hidden
          className="v2-icon h-[10.76px] w-[102.62px] text-[#162544] night:text-v2-ink"
          style={{ maskImage: `url("${logoWordmark}")`, WebkitMaskImage: `url("${logoWordmark}")` }}
        />
      </Link>

      <div className="ml-11 mt-[46.79px]">
        <Divider />
      </div>

      <div className="ml-[44.5px] mt-[16.12px]">
        <BrandKitSwitcher />
      </div>

      <Link
        to="/brand-kit"
        search={{ new: "1" }}
        onClick={onNavigate}
        className="ml-11 mt-[19.6px] flex h-[49.88px] w-[232px] items-center justify-center rounded-[60px] px-5 py-2.5 font-archivo text-base leading-[1.4] text-v2-ink underline decoration-solid underline-offset-[3px] hover:bg-v2-nav-active/60"
      >
        Create a New Brand Kit
      </Link>

      <div className="ml-11 mt-[23.75px]">
        <Divider className="w-[232px]" />
      </div>

      <nav aria-label="Main" className="ml-[45px] mt-[22.56px] flex w-[232px] flex-col gap-3">
        {PRIMARY.map((item) => (
          <NavRow
            key={item.label}
            item={item}
            active={isActive(item)}
            dimClass="opacity-60"
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="ml-[45px] mt-[41.77px] w-[232px]">
        <Divider />
        {GROUPS.map((group, index) => {
          const expanded = isOpen(group.id);
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => setOpen((s) => ({ ...s, [group.id]: !expanded }))}
                aria-expanded={expanded}
                className={cn(
                  "flex w-full items-center justify-between pb-[22px] text-left",
                  index === 0 ? "pt-[22px]" : "pt-[34px]",
                  expanded && "pb-5",
                )}
              >
                <span className="font-archivo text-lg font-medium leading-archivo tracking-[-0.54px] text-v2-ink">
                  {group.label}
                </span>
                <Icon
                  name="chevron"
                  width={6}
                  height={11}
                  className={cn(
                    "text-v2-icon transition-transform duration-200",
                    expanded ? "-rotate-90" : "rotate-90",
                  )}
                />
              </button>
              {expanded ? (
                <div className="flex flex-col gap-2 pb-[23px]">
                  {group.items.map((item) => (
                    <NavRow
                      key={item.label}
                      item={item}
                      active={isActive(item)}
                      dimClass="opacity-50"
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              ) : null}
              <Divider />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar({ footer }: { footer?: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[308px] shrink-0 overflow-y-auto rounded-r-[40px] bg-v2-surface [scrollbar-width:none] lg:block">
      <SidebarContent />
      {footer}
    </aside>
  );
}
