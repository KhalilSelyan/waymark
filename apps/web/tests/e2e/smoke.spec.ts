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

test("authenticated user can create, edit, and archive a place", async ({ page }) => {
  await page.goto("/trips/new");
  await page.getByLabel("Trip name").fill(`Places trip ${Date.now()}`);
  await page.getByLabel("Destination").fill("Lisbon");
  await page.getByRole("button", { name: "Create trip" }).click();
  const tripId = page.url().match(/trips\/([^/]+)\//)?.[1];
  expect(tripId).toBeTruthy();

  await page.goto(`/trips/${tripId}/places`);
  await page.getByLabel("Name").fill("Time Out Market");
  await page.getByLabel("Address").fill("Avenida 24 de Julho");
  await page.getByLabel("Notes").fill("Try the seafood stalls.");
  await page.getByRole("button", { name: "Add place" }).click();
  const place = page.getByRole("heading", { name: "Time Out Market" });
  await expect(place).toBeVisible();
  await expect(page.getByText("Try the seafood stalls.")).toBeVisible();

  await place.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Address").fill("Mercado da Ribeira");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Mercado da Ribeira")).toBeVisible();

  await page.getByRole("button", { name: "Add to canvas" }).click();
  await expect(page.getByRole("status")).toHaveText("Place added to the canvas.");

  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
  await expect(place).not.toBeVisible();
});

test("authenticated planning views remain usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trips/new");
  await page.getByLabel("Trip name").fill(`Mobile planning trip ${Date.now()}`);
  await page.getByLabel("Destination").fill("Lisbon");
  await page.getByRole("button", { name: "Create trip" }).click();
  const tripId = page.url().match(/trips\/([^/]+)\//)?.[1];
  expect(tripId).toBeTruthy();

  for (const section of ["timeline", "expenses", "activity"]) {
    await page.goto(`/trips/${tripId}/${section}`);
    await expect(page.locator("main, section").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus-visible")).toBeVisible();
  }
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

  const secondGuest = await context.browser()?.newContext();
  if (!secondGuest) throw new Error("Could not create second guest browser context.");
  const secondGuestPage = await secondGuest.newPage();
  await secondGuestPage.goto(inviteUrl!);
  await secondGuestPage.getByLabel("Username").fill(`guest_two_${Date.now()}`);
  await secondGuestPage.getByLabel("Display name").fill("Second Guest");
  await secondGuestPage.getByRole("button", { name: "Join trip" }).click();
  await expect(secondGuestPage).toHaveURL(new RegExp(`/trips/${tripId}`));
  await secondGuest.close();

  await page.goto(`/trips/${tripId}/settings/invites`);
  await page.getByRole("button", { name: "Revoke" }).click();
  await page.goto(inviteUrl!);
  await expect(page).toHaveURL("/");
});
