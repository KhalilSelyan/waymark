import { auth } from "@waymark/auth";
import { db } from "@waymark/db";

export type CreateContextOptions = {
  headers: Headers;
};

export type Context = {
  db: typeof db;
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
};

export async function createContext({ headers }: CreateContextOptions): Promise<Context> {
  const session = await auth.api.getSession({ headers });
  return {
    db,
    session,
  };
}
