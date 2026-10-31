type PreparedRedirect = {
  open: (url: string) => void;
  cancel: () => void;
};

/**
 * Open a placeholder tab during the click so the eventual navigation to
 * Shopify isn't blocked as a popup. After the server call resolves, call
 * `open(url)` to navigate the tab, or `cancel()` to close it on error.
 *
 * All popup interactions are wrapped in try/catch — sandboxed previews and
 * COOP can make `popup.opener`, `popup.document`, or `popup.location` throw
 * non-Error DOMExceptions that would otherwise surface as a bogus
 * "Failed to start checkout" toast even though the server succeeded.
 */
export function prepareShopifyAdminRedirect(): PreparedRedirect {
  let popup: Window | null = null;
  try {
    popup = window.open("about:blank", "_blank");
  } catch {
    popup = null;
  }

  if (popup) {
    try {
      popup.document.title = "Opening Shopify…";
      if (popup.document.body) {
        popup.document.body.innerHTML =
          '<main style="font-family: system-ui, sans-serif; padding: 32px; color: #111827;">Opening Shopify…</main>';
      }
    } catch {
      // ignore — cross-origin / sandbox restrictions
    }
  }

  return {
    open(url: string) {
      if (popup && !popup.closed) {
        try {
          popup.location.href = url;
          return;
        } catch {
          try {
            popup.close();
          } catch {
            // ignore
          }
        }
      }
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        window.location.href = url;
      }
    },
    cancel() {
      if (popup && !popup.closed) {
        try {
          popup.close();
        } catch {
          // ignore
        }
      }
    },
  };
}
