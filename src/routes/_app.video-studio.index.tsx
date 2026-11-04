import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/v2/components/shell/AppShell";
import { SectionTitle } from "@/v2/components/primitives";
import { useRecentGenerations } from "@/v2/data/api";
import hubUgc from "@/assets/v2/catalog/loops/hub-ugc.webp";
import hubShorts from "@/assets/v2/catalog/loops/hub-shorts.webp";
import hubConcept from "@/assets/v2/video/hub-concept.png";
import playIcon from "@/assets/v2/icons/play.svg";
import { LoopingPreview } from "@/v2/components/LoopingPreview";

export const Route = createFileRoute("/_app/video-studio/")({
  head: () => ({ meta: [{ title: "Video Studio · Replix AI" }] }),
  component: VideoHubPage,
});

/*
 * Figma titles the first card "Build It Yourself" with a UGC description, and tags
 * Concept Ads "Template + Custom" although the wireframe has no Concept templates.
 */
const STUDIOS = [
  {
    to: "/video-studio/ugc",
    title: "AI UGC Ads",
    description: "A creator talks about, unboxes or uses your product",
    tag: "Template + Custom",
    image: hubUgc,
    videoSrc: "/v2/videos/loops/hub-ugc.mp4",
  },
  {
    to: "/video-studio/shorts",
    title: "Product Shorts",
    description: "5–10 sec product motion: pan, zoom, floating",
    tag: "Template + Custom",
    image: hubShorts,
    videoSrc: "/v2/videos/loops/hub-shorts.mp4",
  },
  {
    to: "/video-studio/concept",
    title: "Concept Ads",
    description: "A short story ad with a hook, climax and ending",
    tag: "Custom · New",
    image: hubConcept,
    videoSrc: undefined,
  },
] as const;

function VideoHubPage() {
  const { data: recent = [] } = useRecentGenerations("video");

  return (
    <AppShell title="Video Studio" subtitle="Pick the kind of video you want to make">
      <div className="mt-10 flex flex-col gap-10">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {STUDIOS.map((studio) => (
            <Link
              key={studio.to}
              to={studio.to}
              className="group flex flex-col overflow-hidden rounded-[14px] border-[0.8px] border-transparent bg-v2-surface transition-colors hover:border-black night:hover:border-v2-ink"
            >
              <span className="block aspect-[334/317] overflow-hidden rounded-[14px]">
                <LoopingPreview
                  frames={[studio.image]}
                  videoSrc={studio.videoSrc}
                  className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />
              </span>
              <span className="flex flex-col items-start gap-3 px-[18px] pb-[7px] pt-[23px]">
                <span className="flex flex-col gap-2">
                  <span className="font-archivo text-xl font-medium leading-archivo tracking-[-0.4px] text-v2-ink">
                    {studio.title}
                  </span>
                  <span className="font-inter-tight text-sm tracking-[-0.28px] text-v2-muted">
                    {studio.description}
                  </span>
                </span>
                <span className="rounded-[50px] border-[0.7px] border-black/60 px-3 py-1.5 font-inter-tight text-[10px] font-medium tracking-[0.2px] text-[#616161] night:border-v2-border night:text-v2-ink-70">
                  {studio.tag}
                </span>
              </span>
            </Link>
          ))}
        </div>

        {recent.length ? (
          <section className="flex flex-col gap-[30px]">
            <SectionTitle>Recent Video Generations</SectionTitle>
            <div className="relative rounded-[18px] bg-v2-surface px-3 py-4 sm:px-[27px] sm:py-7">
              <div className="grid grid-cols-2 gap-x-5 gap-y-[18px] sm:grid-cols-3 lg:grid-cols-5">
                {recent.slice(0, 10).map((video) => (
                  <Link
                    key={video.id}
                    to="/assets"
                    className="group relative aspect-[183/231] overflow-hidden rounded-[12px]"
                    aria-label={`Open ${video.title}`}
                  >
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[26px] bg-white px-[12.4px] py-[11.8px] shadow-sm transition-transform group-hover:scale-110">
                      <img src={playIcon} alt="" className="h-[12.4px] w-[11.2px]" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
