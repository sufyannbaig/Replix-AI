/**
 * Consent for pictures of people. Before a character (a person's photo) is uploaded, the
 * user must confirm they have that person's permission (backend plan, decision D5). The
 * dialog lives once in the app shell (PersonConsentHost); anything that uploads a person
 * calls `askPersonConsent()` and waits for the answer.
 */
type Ask = (answer: (ok: boolean) => void) => void;

let host: Ask | null = null;

/** The mounted dialog registers itself here; pass null when it unmounts. */
export function setConsentHost(next: Ask | null) {
  host = next;
}

/** The error message an upload fails with when the user doesn't confirm. */
export const CONSENT_DECLINED = "consent-declined";

/** Resolves true once the user confirms; false if they cancel (or no dialog is mounted). */
export function askPersonConsent(): Promise<boolean> {
  return new Promise((resolve) => (host ? host(resolve) : resolve(false)));
}
