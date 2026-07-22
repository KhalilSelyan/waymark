import { db } from "@waymark/db";
import { sql } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  try {
    await db.execute(sql`select 1`);
    return new Response(JSON.stringify({ status: "ok", database: "ok" }), { headers: { "content-type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ status: "error", database: "unavailable" }), { status: 503, headers: { "content-type": "application/json" } });
  }
};
