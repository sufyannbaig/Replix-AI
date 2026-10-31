import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CampaignsView } from "@/components/CampaignsView";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/campaigns/")({
  head: () => ({
    meta: [
      { title: "My Campaigns — Replix AI Ad Studio" },
      {
        name: "description",
        content: "Organize saved Replix ad creatives into reusable campaign collections.",
      },
      { property: "og:title", content: "My Campaigns — Replix AI Ad Studio" },
      { property: "og:description", content: "Organize generated creatives into campaign collections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Campaigns,
});

function Campaigns() {
  const [openSignal, setOpenSignal] = useState(0);
  return (
    <AppShell
      title="My Campaigns"
      subtitle="Grouped creatives you can reuse campaign to campaign"
      action={
        <Button
          variant="navy"
          className="hidden rounded-full px-7 sm:inline-flex"
          onClick={() => setOpenSignal((n) => n + 1)}
        >
          <Plus /> Create New Campaign
        </Button>
      }
    >
      <CampaignsView openSignal={openSignal} />
    </AppShell>
  );
}
