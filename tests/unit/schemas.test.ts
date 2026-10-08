import { describe, expect, it } from "vitest";
import { financeSchemas } from "@/lib/schemas/finance";
import { habitSchemas } from "@/lib/schemas/habits";

describe("zod schemas", () => {
  it("accepts finance add payload", () => {
    const parsed = financeSchemas.add.parse({
      title: "  Кофе ",
      amount: "120",
      categoryId: "cat_1",
      date: "2026-10-08T12:00:00",
    });
    expect(parsed.title).toBe("Кофе");
    expect(parsed.amount).toBe(120);
    expect(parsed.date).toBe("2026-10-08");
  });

  it("rejects empty finance title", () => {
    const r = financeSchemas.add.safeParse({ title: "  ", amount: 10, categoryId: "x" });
    expect(r.success).toBe(false);
  });

  it("accepts habit create", () => {
    const parsed = habitSchemas.create.parse({ title: "Вода", frequency: "daily" });
    expect(parsed.title).toBe("Вода");
  });

  it("rejects habit log without habitId", () => {
    const r = habitSchemas.log.safeParse({ action: "log", value: 1 });
    expect(r.success).toBe(false);
  });
});
