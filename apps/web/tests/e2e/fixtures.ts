import { test as base, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const test = base.extend<{ creatorPage: void }>({
  creatorPage: [async ({ page }, use) => {
    const response = await page.request.post("/__e2e/session", { data: { runId: `run-${randomUUID()}` } });
    expect(response.ok()).toBeTruthy();
    await use();
  }, { auto: true }],
});

export { expect };
