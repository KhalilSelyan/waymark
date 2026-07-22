import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const test = base.extend<{ creatorPage: void }>({
  creatorPage: [async ({ page }, use, testInfo) => {
    if (testInfo.title === "landing page loads" || testInfo.title === "login page exposes Google sign-in") {
      await use();
      return;
    }
    const username = `e2e_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const response = await page.request.post("/api/auth/sign-up/email", { data: { name: "E2E Creator", email: `${username}@example.test`, password: "Test-password-123!" } });
    expect(response.ok()).toBeTruthy();
    await page.goto("/onboarding/username");
    await page.locator("#username").fill(username);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your trips" })).toBeVisible();
    await use();
  }, { auto: true }],
});

export { expect };
