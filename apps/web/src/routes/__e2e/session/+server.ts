import { error, json } from "@sveltejs/kit";
import { db } from "@waymark/db";
import { user } from "@waymark/db/schema/auth";
import { userProfiles } from "@waymark/db/schema";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ cookies, request }) => {
  if (process.env.WAYMARK_E2E !== "true") throw error(404, "Not found");
  const body = await request.json().catch(() => ({})) as { runId?: string };
  const suffix = String(body.runId ?? randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  const userId = `e2e-${suffix}`;
  const email = `${userId}@example.test`;
  const existing = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!existing) {
    await db.insert(user).values({ id: userId, name: "E2E Creator", email, emailVerified: true });
    await db.insert(userProfiles).values({ userId, username: `e2e_${suffix.slice(0, 16)}`, displayName: "E2E Creator" });
  }
  const token = randomUUID();
  await db.insert((await import("@waymark/db/schema/auth")).session).values({ id: randomUUID(), token, userId, expiresAt: new Date(Date.now() + 60 * 60 * 1000), ipAddress: "127.0.0.1", userAgent: "Waymark Playwright" });
  cookies.set("better-auth.session_token", token, { path: "/", httpOnly: true, sameSite: "lax", secure: false, maxAge: 60 * 60 });
  return json({ userId, email });
};
