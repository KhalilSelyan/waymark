import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const test = base.extend<{ creatorPage: void }>({
  creatorPage: [async ({ page }, use, testInfo) => {
    if (testInfo.title === "landing page loads" || testInfo.title === "login page exposes Google sign-in") {
      await use();
      return;
    }
    const response = await page.request.post("/__e2e/session", { data: { runId: `${testInfo.testId}-${randomUUID()}` } });
    expect(response.ok()).toBeTruthy();
    const session = await response.json() as { token: string };
    await page.context().addCookies([
      { name: "better-auth.session_token", value: session.token, domain: "127.0.0.1", path: "/" },
      { name: "__Secure-better-auth.session_token", value: session.token, domain: "127.0.0.1", path: "/", secure: true },
    ]);
    await page.goto("/dashboard");
    await use();
  }, { auto: true }],
});

export { expect };
