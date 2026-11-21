import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/v2/landing/LandingPage";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Replix AI | Turn any product photo into scroll-stopping ads" },
      {
        name: "description",
        content:
          "Upload a product photo and Replix AI turns it into polished, scroll-stopping ad creatives. Try 10 free ads. No credit card required.",
      },
      {
        property: "og:title",
        content: "Replix AI | Turn any product photo into scroll-stopping ads",
      },
      {
        property: "og:description",
        content:
          "Upload a product photo and Replix AI turns it into polished, scroll-stopping ad creatives. Try 10 free ads. No credit card required.",
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
          "Upload a product photo and Replix AI turns it into polished, scroll-stopping ad creatives. Try 10 free ads. No credit card required.",
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
