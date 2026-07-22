import { auth } from "@waymark/auth";
import { db } from "@waymark/db";
import { createHash } from "node:crypto";

export type CreateContextOptions = {
  headers: Headers;
  cookies?: { get: (name: string) => string | undefined };
};

export type Context = {
  db: typeof db;
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
  guestTokenHashes: string[];
};

export async function createContext({ headers, cookies }: CreateContextOptions): Promise<Context> {
  const session = await auth.api.getSession({ headers });
  const cookieHeader = headers.get("cookie") ?? "";
  const guestTokenHashes = [...cookieHeader.matchAll(/(?:^|;\s*)waymark_guest_[^=]+=([^;]*)/g)].map((match) => createHash("sha256").update(match[1]!).digest("hex"));
  return {
    db,
    session,
    guestTokenHashes,
  };
}
