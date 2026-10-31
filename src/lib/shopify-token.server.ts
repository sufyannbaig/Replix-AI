import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { migrateToExpiringToken, refreshAccessToken } from "@/lib/shopify-app.server";

type ShopifyInstallation = {
  id: string;
  shop_domain: string;
  access_token: string;
  refresh_token: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  user_id?: string | null;
  uninstalled_at?: string | null;
};

type EnsureTokenOptions = {
  /** Refresh even if the stored expiry says the token is still valid. */
  forceRefresh?: boolean;
};

function tokenExpiry(value: string | null) {
  return value ? new Date(value) : null;
}

function expiryFromSeconds(base: Date, seconds?: number) {
  return seconds ? new Date(base.getTime() + seconds * 1000) : null;
}

export async function ensureValidShopifyAccessToken<T extends ShopifyInstallation>(
  installation: T,
  options: EnsureTokenOptions = {},
): Promise<T & { access_token: string }> {
  let accessToken = installation.access_token;
  let refreshToken = installation.refresh_token;
  let accessTokenExpiresAt = tokenExpiry(installation.access_token_expires_at);
  let refreshTokenExpiresAt = tokenExpiry(installation.refresh_token_expires_at);

  const persistTokenState = async (updatedAt: Date) => {
    const { error } = await supabaseAdmin
      .from("shopify_installations")
      .update({
        access_token: accessToken,
        refresh_token: refreshToken,
        access_token_expires_at: accessTokenExpiresAt?.toISOString() ?? null,
        refresh_token_expires_at: refreshTokenExpiresAt?.toISOString() ?? null,
        updated_at: updatedAt.toISOString(),
      })
      .eq("id", installation.id);
    if (error) throw new Error(`Failed to save Shopify token: ${error.message}`);
  };

  const migrateLegacyToken = async () => {
    const migrated = await migrateToExpiringToken(installation.shop_domain, accessToken);
    const migratedAt = new Date();
    accessToken = migrated.access_token;
    refreshToken = migrated.refresh_token ?? null;
    accessTokenExpiresAt = expiryFromSeconds(migratedAt, migrated.expires_in);
    refreshTokenExpiresAt = expiryFromSeconds(migratedAt, migrated.refresh_token_expires_in);
    await persistTokenState(migratedAt);
  };

  const refreshExpiringToken = async () => {
    const now = new Date();
    if (refreshTokenExpiresAt && now.getTime() >= refreshTokenExpiresAt.getTime()) {
      throw new Error("Your Shopify session has expired. Please reconnect your store.");
    }
    if (!refreshToken) {
      throw new Error("Your Shopify store needs to be reconnected before billing can continue.");
    }

    const refreshed = await refreshAccessToken(installation.shop_domain, refreshToken);
    const refreshedAt = new Date();
    accessToken = refreshed.access_token;
    refreshToken = refreshed.refresh_token ?? refreshToken;
    accessTokenExpiresAt = expiryFromSeconds(refreshedAt, refreshed.expires_in);
    refreshTokenExpiresAt = refreshed.refresh_token_expires_in
      ? expiryFromSeconds(refreshedAt, refreshed.refresh_token_expires_in)
      : refreshTokenExpiresAt;
    await persistTokenState(refreshedAt);
  };

  if (!refreshToken || !accessTokenExpiresAt) {
    await migrateLegacyToken();
  } else if (options.forceRefresh) {
    try {
      await refreshExpiringToken();
    } catch (refreshError) {
      try {
        await migrateLegacyToken();
      } catch {
        throw refreshError;
      }
    }
  }

  const now = new Date();
  const refreshBufferMs = 5 * 60 * 1000;
  if (accessTokenExpiresAt && now.getTime() + refreshBufferMs >= accessTokenExpiresAt.getTime()) {
    await refreshExpiringToken();
  }

  return { ...installation, access_token: accessToken };
}