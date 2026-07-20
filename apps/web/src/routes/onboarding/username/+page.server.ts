import { fail, redirect } from "@sveltejs/kit";
import { auth } from "@waymark/auth";
import { db } from "@waymark/db";
import { userProfiles } from "@waymark/db/schema";
import { eq } from "drizzle-orm";
import { usernameSchema } from "./validation";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ request }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw redirect(303, "/login");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, session.user.id),
  });
  if (profile) throw redirect(303, "/dashboard");

  return { displayName: session.user.name };
};

export const actions: Actions = {
  default: async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw redirect(303, "/login");

    const formData = await request.formData();
    const result = usernameSchema.safeParse(formData.get("username"));
    if (!result.success) {
      return fail(400, { username: String(formData.get("username") ?? ""), error: result.error.issues[0]?.message });
    }

    const existing = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.username, result.data),
    });
    if (existing && existing.userId !== session.user.id) {
      return fail(409, { username: result.data, error: "That username is already taken." });
    }

    await db.insert(userProfiles).values({
      userId: session.user.id,
      username: result.data,
      displayName: session.user.name,
    });

    throw redirect(303, "/dashboard");
  },
};
