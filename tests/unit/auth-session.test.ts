import { beforeEach, describe, expect, it } from "vitest";
import { hashPassword, newAccountId, verifyPassword } from "@/lib/accounts";
import {
  SESSION_COOKIE,
  isTenantMode,
  signSession,
  verifySessionValue,
} from "@/lib/auth";
import { DEFAULT_SNAPSHOT_ID } from "@/lib/cloud-store";

describe("auth + accounts", () => {
  beforeEach(() => {
    process.env.MINDOS_SESSION_SECRET =
      process.env.MINDOS_SESSION_SECRET || "vitest-session-secret-32bytes!!";
  });

  it("hashes and verifies passwords", () => {
    const hash = hashPassword("CorrectHorseBattery");
    expect(verifyPassword("CorrectHorseBattery", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("creates unique account ids", () => {
    expect(newAccountId()).not.toBe(newAccountId());
  });

  it("signs and verifies sessions", () => {
    const token = signSession({ accountId: "acc_alice", login: "alice" });
    expect(token).toBeTruthy();
    const session = verifySessionValue(token!);
    expect(session?.accountId).toBe("acc_alice");
    expect(session?.login).toBe("alice");
  });

  it("rejects tampered sessions", () => {
    const token = signSession({ accountId: "acc_alice", login: "alice" });
    expect(verifySessionValue(token + "x")).toBeNull();
    expect(verifySessionValue(undefined)).toBeNull();
  });

  it("exposes stable cookie / snapshot constants", () => {
    expect(SESSION_COOKIE).toBe("mindos_session");
    expect(DEFAULT_SNAPSHOT_ID).toBe("default");
  });

  it("tenant mode follows MINDOS_MULTI_TENANT when not forced", () => {
    const prev = process.env.MINDOS_MULTI_TENANT;
    process.env.MINDOS_MULTI_TENANT = "1";
    expect(isTenantMode()).toBe(true);
    if (!process.env.VERCEL && process.env.MINDOS_CLOUD_PRIMARY !== "1") {
      delete process.env.MINDOS_MULTI_TENANT;
      expect(isTenantMode()).toBe(false);
    }
    if (prev === undefined) delete process.env.MINDOS_MULTI_TENANT;
    else process.env.MINDOS_MULTI_TENANT = prev;
  });
});
