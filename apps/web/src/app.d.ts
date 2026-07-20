import type { AppRouterClient } from "@waymark/api/routers/index";
import type { auth } from "@waymark/auth";

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
type AuthSessionData = NonNullable<AuthSession>;

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  var $client: AppRouterClient | undefined;

  namespace App {
    interface Locals {
      session: AuthSessionData["session"] | null;
      user: AuthSessionData["user"] | null;
    }
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
