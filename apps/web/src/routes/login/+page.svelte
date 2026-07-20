<script lang="ts">
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button/index.js";

  let isLoading = $state(false);
  let errorMessage = $state("");

  async function signInWithGoogle() {
    isLoading = true;
    errorMessage = "";

    await authClient.signIn.social(
      { provider: "google", callbackURL: "/dashboard" },
      {
        onError: (error) => {
          errorMessage = error.error.message || "Google sign-in failed.";
          isLoading = false;
        },
      },
    );
  }
</script>

<svelte:head>
  <title>Sign in | Waymark</title>
</svelte:head>

<main class="flex min-h-full items-center justify-center px-6 py-16">
  <section class="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-2xl">
    <div class="mb-8 space-y-3">
      <p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Waymark</p>
      <h1 class="text-3xl font-semibold tracking-tight">Plan the trip together.</h1>
      <p class="text-sm leading-6 text-muted-foreground">
        Sign in to create a shared trip workspace for plans, places, and expenses.
      </p>
    </div>

    <Button class="w-full" size="lg" disabled={isLoading} onclick={signInWithGoogle}>
      {isLoading ? "Opening Google..." : "Continue with Google"}
    </Button>

    {#if errorMessage}
      <p class="mt-4 text-sm text-destructive" role="alert">{errorMessage}</p>
    {/if}
  </section>
</main>
