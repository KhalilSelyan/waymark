import { expect, test } from "./fixtures";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("API Status")).toBeVisible();
});

test("login page exposes Google sign-in", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
});

test("E2E account reaches the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your trips" })).toBeVisible();
});
