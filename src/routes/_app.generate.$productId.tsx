import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { setProductIntake } from "@/lib/product-intake";

export const Route = createFileRoute("/_app/generate/$productId")({
  component: GenerateProductRedirect,
});

// Legacy route — hand the product to /create via the intake contract.
function GenerateProductRedirect() {
  const { productId } = Route.useParams();

  useEffect(() => {
    if (productId) setProductIntake({ kind: "shopify", handle: productId });
  }, [productId]);

  return <Navigate to="/create" replace />;
}
