import type { Handle } from "@sveltejs/kit/hooks";
import "./lib/orpc.server";
import { building } from "$app/env";
import { auth } from "@waymark/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";

export const handle: Handle = async ({ event, resolve }) => {
  const authInstance = auth;

  const session = await authInstance.api.getSession({
    headers: event.request.headers,
  });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user;
  }

  return svelteKitHandler({
    event,
    resolve,
    auth: authInstance,
    building,
  });
};
