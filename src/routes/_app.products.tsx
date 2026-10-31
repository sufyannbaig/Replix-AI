import { createFileRoute } from "@tanstack/react-router";
import { ScreenPlaceholder } from "@/v2/components/Placeholder";

export const Route = createFileRoute("/_app/products")({
  head: () => ({ meta: [{ title: "Products · Replix AI" }] }),
  component: () => (
    <ScreenPlaceholder title="Products" subtitle="Your catalogue, ready to create with" />
  ),
});
