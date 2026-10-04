/**
 * Critical path checks for auth, sessions, and tenant snapshot ids.
 * Run: npm run test:critical
 */
import assert from "assert";
import { hashPassword, verifyPassword, newAccountId } from "../src/lib/accounts";
import { signSession, verifySessionValue, SESSION_COOKIE, isTenantMode } from "../src/lib/auth";
import { DEFAULT_SNAPSHOT_ID } from "../src/lib/cloud-store";

process.env.MINDOS_SESSION_SECRET =
  process.env.MINDOS_SESSION_SECRET || "smoke-critical-session-secret-32b";

let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(e instanceof Error ? e.message : e);
  }
}

check("password hash roundtrip", () => {
  const hash = hashPassword("CorrectHorseBattery");
  assert.ok(verifyPassword("CorrectHorseBattery", hash));
  assert.ok(!verifyPassword("wrong-password", hash));
  assert.ok(hash.startsWith("scrypt$"));
});

check("account ids are unique", () => {
  const a = newAccountId();
  const b = newAccountId();
  assert.ok(a.startsWith("acc_"));
  assert.notStrictEqual(a, b);
});

check("session signs and verifies", () => {
  const token = signSession({ accountId: "acc_alice", login: "alice" });
  assert.ok(token);
  const session = verifySessionValue(token!);
  assert.strictEqual(session?.accountId, "acc_alice");
  assert.strictEqual(session?.login, "alice");
  assert.ok((session?.exp ?? 0) > Math.floor(Date.now() / 1000));
});

check("tampered session rejected", () => {
  const token = signSession({ accountId: "acc_alice", login: "alice" });
  assert.ok(!verifySessionValue(token + "x"));
  assert.ok(!verifySessionValue(undefined));
  assert.ok(!verifySessionValue("not.a.token"));
});

check("two sessions stay isolated", () => {
  const a = verifySessionValue(signSession({ accountId: "acc_a", login: "a" })!);
  const b = verifySessionValue(signSession({ accountId: "acc_b", login: "b" })!);
  assert.notStrictEqual(a?.accountId, b?.accountId);
  assert.strictEqual(a?.accountId, "acc_a");
  assert.strictEqual(b?.accountId, "acc_b");
});

check("snapshot id constants", () => {
  assert.strictEqual(DEFAULT_SNAPSHOT_ID, "default");
  assert.strictEqual(SESSION_COOKIE, "mindos_session");
});

check("tenant mode respects env flag", () => {
  const prev = process.env.MINDOS_MULTI_TENANT;
  process.env.MINDOS_MULTI_TENANT = "1";
  assert.strictEqual(isTenantMode(), true);
  process.env.MINDOS_MULTI_TENANT = "0";
  // VERCEL may still force tenant mode in CI; only assert flag path when unset
  if (!process.env.VERCEL && process.env.MINDOS_CLOUD_PRIMARY !== "1") {
    delete process.env.MINDOS_MULTI_TENANT;
    assert.strictEqual(isTenantMode(), false);
  }
  if (prev === undefined) delete process.env.MINDOS_MULTI_TENANT;
  else process.env.MINDOS_MULTI_TENANT = prev;
});

if (failed) {
  console.error(`\n${failed} critical check(s) failed`);
  process.exit(1);
}
console.log("\nall critical checks passed");
