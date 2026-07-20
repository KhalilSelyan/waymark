import { building } from "$app/environment";
import { auth } from "@waymark/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import type { RequestHandler } from "./$types";

const handler: RequestHandler = async (event) =>
  svelteKitHandler({
    event,
    resolve: () => new Response(null, { status: 404 }),
    auth,
    building,
  });

export const GET = handler;
export const POST = handler;
