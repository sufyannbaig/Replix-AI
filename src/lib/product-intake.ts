export type ProductIntake =
  | { kind: "shopify"; handle: string }
  | { kind: "upload"; name: string; dataUrl: string }
  | { kind: "url"; url: string };

const KEY = "replix-product-intake";

let pendingIntake: ProductIntake | null = null;

export function setProductIntake(intake: ProductIntake) {
  pendingIntake = intake;
  if (typeof window !== "undefined") window.sessionStorage.setItem(KEY, JSON.stringify(intake));
}

export function takeProductIntake() {
  let intake = pendingIntake;
  if (!intake && typeof window !== "undefined") {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored) {
      try {
        intake = JSON.parse(stored) as ProductIntake;
      } catch {
        intake = null;
      }
    }
  }
  pendingIntake = null;
  if (typeof window !== "undefined") window.sessionStorage.removeItem(KEY);
  return intake;
}
