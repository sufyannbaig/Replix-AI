import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/v2/landing/LandingPage";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Replix AI | On-brand product photos, ads and videos from one photo" },
      {
        name: "description",
        content:
          "Paste your website and Replix builds your brand kit, then turns one product photo into on-brand photoshoots, ads, UGC and product videos. Free brand kit, no credit card.",
      },
      {
        property: "og:title",
        content: "Replix AI | On-brand product photos, ads and videos from one photo",
      },
      {
        property: "og:description",
        content:
          "Paste your website and Replix builds your brand kit, then turns one product photo into on-brand photoshoots, ads, UGC and product videos. Free brand kit, no credit card.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://replixai.co.uk/" },
      {
        property: "og:image",
        content:
          "https://replixai.co.uk/__l5e/assets-v1/1e8e075d-2fc3-4707-9dc6-796c23b6ee43/og-preview-v2.png",
      },
      { property: "og:image:width", content: "1920" },
      { property: "og:image:height", content: "984" },
      { property: "og:image:type", content: "image/webp" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:image",
        content:
          "https://replixai.co.uk/__l5e/assets-v1/1e8e075d-2fc3-4707-9dc6-796c23b6ee43/og-preview-v2.png",
      },
      {
        name: "twitter:description",
        content:
          "Paste your website and Replix builds your brand kit, then turns one product photo into on-brand photoshoots, ads, UGC and product videos. Free brand kit, no credit card.",
      },
    ],
    links: [{ rel: "canonical", href: "https://replixai.co.uk/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Replix AI",
          url: "https://replixai.co.uk/",
        }),
      },
    ],
  }),
});
