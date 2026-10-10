import { describe, expect, it } from "vitest";
import { CURRENT_VERSION, migrateStore } from "@/lib/migrate";
import { createEmptyStore } from "@/lib/seed";

describe("migrateStore", () => {
  it("client seed is current and stays empty after migrate", () => {
    const store = createEmptyStore();
    expect(store.version).toBe(CURRENT_VERSION);
    expect(store.goals).toHaveLength(0);
    expect(store.projects).toHaveLength(0);
    const next = migrateStore(structuredClone(store));
    expect(next.version).toBe(CURRENT_VERSION);
    expect(next.goals).toHaveLength(0);
    expect(next.projects).toHaveLength(0);
    expect(Array.isArray(next.habits)).toBe(true);
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
