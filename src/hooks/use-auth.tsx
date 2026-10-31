import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { sendWelcomeEmailIfNeeded } from "@/lib/email/triggers.functions";
import { redeemReferralCode } from "@/lib/referrals/referrals.functions";
import { trackBrowserRegistration } from "@/lib/meta-registration";

const REFERRAL_STORAGE_KEY = "replix.pendingReferralCode";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        setSession(s);
        setLoading(false);
        // Fire-and-forget welcome email on sign-in. Idempotent on the server.
        if (event === "SIGNED_IN" && s?.user) {
          void sendWelcomeEmailIfNeeded().catch(() => {});
          trackBrowserRegistration(s.user, "oauth");
          // Attempt to redeem pending referral code (no-op if already redeemed)
          try {
            const code = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
            if (code) {
              void redeemReferralCode({ data: { code } })
                .catch(() => {})
                .finally(() => {
                  try { window.localStorage.removeItem(REFERRAL_STORAGE_KEY); } catch {}
                });
            }
          } catch {}
        }
      },
    );
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);



  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Soft-fail for public/SSR renders where the provider is not yet mounted.
    return { user: null, session: null, loading: false, signOut: async () => {} };
  }
  return ctx;
}
