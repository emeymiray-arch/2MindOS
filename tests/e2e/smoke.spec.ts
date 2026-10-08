import { expect, test } from "@playwright/test";

test.describe("critical navigation", () => {
  test("home loads shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    // AuthGate may show login or the app; either way the document is alive.
    await expect(page).toHaveTitle(/2Mind/i);
  });

  test("habits and finance routes respond", async ({ page }) => {
    for (const path of ["/habits", "/finance", "/goals"]) {
      const res = await page.goto(path);
      expect(res?.ok() || res?.status() === 200 || res?.status() === 304).toBeTruthy();
      await expect(page.locator("body")).toBeVisible();
    }
  });

  test("health API is up", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
  });
});
