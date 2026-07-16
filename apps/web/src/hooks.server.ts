import "./lib/orpc.server";
import { building } from "$app/environment";
import type { Handle } from "@sveltejs/kit";
import { auth } from "@waymark/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";

export const handle: Handle = async ({ event, resolve }) => {
  const authInstance = auth;

  return svelteKitHandler({
    event,
    resolve,
    auth: authInstance,
    building,
  });
};
