import { cn } from "@/lib/utils";
import { Stage, useTick } from "@/v2/components/home/StudioMotion";
import p01 from "@/assets/v2/catalog/photo/fruit-burst.webp";
import p02 from "@/assets/v2/catalog/photo/ice-crush.webp";
import p03 from "@/assets/v2/catalog/photo/golden-skin.webp";
import p04 from "@/assets/v2/catalog/photo/trail-dawn.webp";
import p05 from "@/assets/v2/catalog/photo/spotlight-noir.webp";
import p06 from "@/assets/v2/catalog/photo/sky-high.webp";
import p07 from "@/assets/v2/catalog/photo/palm-shadow.webp";
import p08 from "@/assets/v2/catalog/photo/desk-setup.webp";
import p09 from "@/assets/v2/catalog/photo/splash-burst.webp";
import p10 from "@/assets/v2/catalog/photo/studio-stride.webp";
import p11 from "@/assets/v2/catalog/photo/monolith.webp";
import p12 from "@/assets/v2/catalog/photo/power-burst.webp";

/*
 * The sign-in screen's moving picture: a slow wall of product photos made in Replix, with
 * the three things it makes named over it. Holds still for people who prefer reduced motion.
 */

const COLUMNS = [
  [p01, p02, p03, p04],
  [p05, p06, p07, p08],
  [p09, p10, p11, p12],
];
const MAKES = ["Product photos.", "Ad creatives.", "Video ads."];

export function AuthHeroMotion() {
  const i = useTick(MAKES.length, 2600);
  return (
    <div className="absolute inset-0">
      <Stage className="bg-[#0b1b3f]">
        <span
          className="absolute left-1/2 top-1/2 flex h-[150cqh] gap-[2.2cqh]"
          style={{ transform: "translate(-50%, -50%) rotate(-8deg)" }}
        >
          {COLUMNS.map((photos, c) => (
            <span key={c} className="block w-[30cqh] overflow-hidden">
              <span
                className="flex flex-col gap-[2.2cqh] pb-[2.2cqh] motion-reduce:!animate-none"
                style={{
                  animation: `${c === 1 ? "sm-scroll-down" : "sm-scroll-up"} ${52 + c * 6}s linear infinite`,
                }}
              >
                {[...photos, ...photos].map((src, k) => (
                  <img
                    key={k}
                    src={src}
                    alt=""
                    className="aspect-[4/5] w-full rounded-[2.4cqh] object-cover"
                  />
                ))}
              </span>
            </span>
          ))}
        </span>

        <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(8,20,52,.94)_0%,rgba(8,20,52,.55)_38%,rgba(8,20,52,.15)_70%,rgba(8,20,52,.35)_100%)]" />

        <span className="absolute inset-x-[7cqh] bottom-[8cqh] flex flex-col gap-[2.4cqh] text-white">
          <span className="text-[2.4cqh] font-medium uppercase tracking-[0.18em] text-white/70">
            From one product photo
          </span>
          <span className="block h-[8.4cqh] overflow-hidden">
            <span
              key={i}
              className="block font-archivo text-[7.4cqh] font-semibold uppercase leading-[1.1] tracking-[-0.03em]"
              style={{ animation: "sm-rise .5s cubic-bezier(.2,.8,.2,1)" }}
            >
              {MAKES[i]}
            </span>
          </span>
          <span className="flex gap-[1.6cqh]">
            {["Photo Studio", "Ad Studio", "Video Studio"].map((studio, k) => (
              <span
                key={studio}
                className={cn(
                  "rounded-full px-[2.2cqh] py-[1.3cqh] text-[2.2cqh] font-medium leading-none transition-colors duration-300",
                  k === i
                    ? "bg-gradient-to-b from-[#d0ffb6] to-[#ffebc9] text-black"
                    : "bg-white/12 text-white/75",
                )}
              >
                {studio}
              </span>
            ))}
          </span>
        </span>
      </Stage>
      <span className="sr-only">
        Product photos, ad creatives and video ads made in Replix from one product photo.
      </span>
    </div>
  );
}
