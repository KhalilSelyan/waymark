import { expect, test } from "./fixtures";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The trip plan your whole group can actually use." })).toBeVisible();
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

test("creator can generate an invite and a guest can join", async ({ page, context }) => {
  await page.goto("/trips/new");
  await page.getByLabel("Trip name").fill(`Invite trip ${Date.now()}`);
  await page.getByRole("button", { name: "Create trip" }).click();
  const tripId = page.url().match(/trips\/([^/]+)\//)?.[1];
  expect(tripId).toBeTruthy();
  await page.goto(`/trips/${tripId}/settings/invites`);
  await page.getByRole("button", { name: "Create invite link" }).click();
  const invite = page.locator("text=/https?:\/\/.*\/invite\//");
  await expect(invite).toBeVisible();
  const inviteUrl = (await invite.textContent())?.trim();
  expect(inviteUrl).toMatch(/\/invite\//);
  const guest = await context.browser()?.newContext();
  if (!guest) throw new Error("Could not create guest browser context.");
  const guestPage = await guest.newPage();
  await guestPage.goto(inviteUrl!);
  await guestPage.getByLabel("Username").fill(`guest_${Date.now()}`);
  await guestPage.getByLabel("Display name").fill("E2E Guest");
  await guestPage.getByRole("button", { name: "Join trip" }).click();
  await expect(guestPage).toHaveURL(new RegExp(`/trips/${tripId}`));
  await guest.close();
});
