<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button/index.js";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
  <title>Choose your username | Waymark</title>
</svelte:head>

<main class="flex min-h-full items-center justify-center px-6 py-16">
  <section class="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-2xl">
    <div class="mb-8 space-y-3">
      <p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">One last step</p>
      <h1 class="text-3xl font-semibold tracking-tight">Choose your Waymark name.</h1>
      <p class="text-sm leading-6 text-muted-foreground">
        You can change your display name later. Your username identifies you in shared trips.
      </p>
    </div>

    <form method="POST" use:enhance class="space-y-5">
      <label class="block space-y-2" for="username">
        <span class="text-sm font-medium">Username</span>
        <input
          id="username"
          name="username"
          required
          minlength="3"
          maxlength="24"
          pattern="[a-zA-Z0-9_-]+"
          value={form?.username ?? ""}
          class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="your_name"
        />
      </label>

      {#if form?.error}
        <p class="text-sm text-destructive" role="alert">{form.error}</p>
      {/if}

      <p class="text-xs text-muted-foreground">3–24 characters: letters, numbers, underscores, or hyphens.</p>
      <Button class="w-full" type="submit">Continue</Button>
    </form>
  </section>
</main>
