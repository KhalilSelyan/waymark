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

test("dashboard remains usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your trips" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
});

test("authenticated user can create a trip", async ({ page }) => {
  await page.goto("/trips/new");
  await page.getByLabel("Trip name").fill(`E2E trip ${Date.now()}`);
  await page.getByLabel("Destination").fill("Lisbon");
  await page.getByLabel("Currency").fill("EUR");
  await page.getByRole("button", { name: "Create trip" }).click();
  await expect(page.getByText("Shared planning board")).toBeVisible();
});
