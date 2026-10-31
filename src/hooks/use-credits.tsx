import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type Credits = { credits: number; plan: string };

/** Fired after any action that changes the signed-in user's credit balance. */
export const CREDITS_CHANGED = "replix:credits-changed";
export function notifyCreditsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CREDITS_CHANGED));
}

export function useCredits() {
  const { user } = useAuth();
  const instanceId = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  );
  const [data, setData] = useState<Credits | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    const { data: row } = await supabase
      .from("user_credits")
      .select("credits, plan")
      .eq("user_id", user.id)
      .maybeSingle();
    setData(row ?? { credits: 0, plan: "free" });
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    if (!user) return;
    const onChanged = () => void refresh();
    window.addEventListener(CREDITS_CHANGED, onChanged);
    const channel = supabase
      .channel(`credits-${user.id}-${instanceId.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_credits", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      window.removeEventListener(CREDITS_CHANGED, onChanged);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { credits: data?.credits ?? 0, plan: data?.plan ?? "free", loading, refresh };
}
