import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCredits } from "@/hooks/use-credits";
import { useStartGeneration } from "@/v2/data/api";
import type { GenerationRequest, StudioKey } from "@/v2/data/types";

const WHAT: Record<StudioKey, string> = {
  photo: "this shoot",
  ad: "these ads",
  ugc: "this video",
  shorts: "this short",
  concept: "this concept ad",
};

/** Dev `?preview=1` has no signed-in user (0 credits); let it reach the result screen. */
function isDevPreview() {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("replix-dev-preview") === "1"
  );
}

/**
 * What every studio's Generate button does: check credits, start the job, open the
 * result screen. Also used by Regenerate on the result screen.
 */
export function useGenerate() {
  const navigate = useNavigate();
  const { credits } = useCredits();
  const start = useStartGeneration();

  const generate = (request: GenerationRequest, options: { replace?: boolean } = {}) => {
    if (credits < request.cost && !isDevPreview()) {
      toast.error(`You need ${request.cost} credits for ${WHAT[request.studio]}.`, {
        action: { label: "Upgrade", onClick: () => navigate({ to: "/upgrade" }) },
      });
      return;
    }
    start.mutate(request, {
      onSuccess: (job) =>
        navigate({
          to: "/generations/$jobId",
          params: { jobId: job.id },
          replace: options.replace,
        }),
      onError: (error) =>
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "Couldn't start the generation. Please try again.",
        ),
    });
  };

  return { generate, pending: start.isPending };
}
