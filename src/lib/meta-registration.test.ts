import { describe, test } from "node:test";
import { deepStrictEqual, doesNotThrow, strictEqual } from "node:assert";
import { trackRegistration } from "./meta-registration";

const created = "2026-10-11T20:17:00.000Z";
const user = { id: "new-account", created_at: created, last_sign_in_at: created, app_metadata: { provider: "google" }, identities: [{}] };
function setup() {
  const values = new Map<string, string>();
  const events: string[][] = [];
  return { events, environment: { now: Date.parse(created), storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }, fbq: (...args: string[]) => { events.push(args); } } };
}
describe("Meta registration tracking", () => {
  test("successful new signup fires CompleteRegistration once", () => {
    const { events, environment } = setup();
    trackRegistration(user, "signup", environment);
    trackRegistration(user, "signup", environment);
    deepStrictEqual(events, [["track", "CompleteRegistration"]]);
  });
  test("new Google signup fires once across repeated auth notifications", () => {
    const { events, environment } = setup();
    trackRegistration(user, "oauth", environment);
    trackRegistration(user, "oauth", environment);
    deepStrictEqual(events, [["track", "CompleteRegistration"]]);
  });
  test("returning Google login does not count as signup even on a new device", () => {
    const { events, environment } = setup();
    trackRegistration({ ...user, last_sign_in_at: "2026-10-11T20:18:00.000Z" }, "oauth", environment);
    deepStrictEqual(events, []);
  });
  test("email sign-in never counts as an OAuth signup", () => {
    const { events, environment } = setup();
    trackRegistration({ ...user, app_metadata: { provider: "email" } }, "oauth", environment);
    deepStrictEqual(events, []);
  });
  test("existing-account signup response does not fire registration", () => {
    const { events, environment } = setup();
    trackRegistration({ ...user, identities: [] }, "signup", environment);
    deepStrictEqual(events, []);
  });
  test("blocked pixel does not throw or mark a registration as tracked", () => {
    const { environment } = setup();
    doesNotThrow(() => trackRegistration(user, "signup", { ...environment, fbq: undefined }));
    strictEqual(environment.storage.getItem("replix.fbRegistered.new-account"), null);
  });
});