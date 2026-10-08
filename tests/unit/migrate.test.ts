import { describe, expect, it } from "vitest";
import { CURRENT_VERSION, migrateStore } from "@/lib/migrate";
import { createEmptyStore } from "@/lib/seed";

describe("migrateStore", () => {
  it("upgrades empty seed store to CURRENT_VERSION", () => {
    const store = createEmptyStore();
    expect(store.version).toBeLessThan(CURRENT_VERSION);
    const next = migrateStore(structuredClone(store));
    expect(next.version).toBe(CURRENT_VERSION);
    expect(Array.isArray(next.habits)).toBe(true);
    expect(Array.isArray(next.goals)).toBe(true);
    expect(next.settings?.theme).toBeTruthy();
  });

  it("is idempotent on already-migrated store", () => {
    const once = migrateStore(structuredClone(createEmptyStore()));
    const twice = migrateStore(structuredClone(once));
    expect(twice.version).toBe(CURRENT_VERSION);
    expect(twice.goals.length).toBe(once.goals.length);
    expect(twice.habits.length).toBe(once.habits.length);
  });
});
