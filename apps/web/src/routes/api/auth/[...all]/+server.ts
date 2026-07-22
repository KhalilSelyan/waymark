import { auth } from "@waymark/auth";
import type { RequestHandler } from "./$types";

const handler: RequestHandler = async ({ request }) => auth.handler(request);

export const GET = handler;
export const POST = handler;
