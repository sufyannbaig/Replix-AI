import { useMutation, useQueryClient } from "@tanstack/react-query";
import { buyCreditPack, deleteGenerationOutput, deleteMyAccount } from "@/lib/v2/account.functions";
import { supabase } from "@/integrations/supabase/client";

/** Delete one generated result (picture or video) for good. */
export function useDeleteOutput() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (outputId: string) => deleteGenerationOutput({ data: { outputId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["v2", "assets"] });
      void queryClient.invalidateQueries({ queryKey: ["v2", "recent"] });
      void queryClient.invalidateQueries({ queryKey: ["v2", "job"] });
    },
  });
}

/** Delete the account and everything in it, then sign out. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await deleteMyAccount({ data: { confirm: "DELETE" } });
      await supabase.auth.signOut().catch(() => undefined);
    },
  });
}

/** Open Stripe Checkout for a one-off credit pack. */
export function useBuyCreditPack() {
  return useMutation({
    mutationFn: async (credits: number) => {
      const { checkoutUrl } = await buyCreditPack({ data: { credits } });
      window.location.assign(checkoutUrl);
    },
  });
}
