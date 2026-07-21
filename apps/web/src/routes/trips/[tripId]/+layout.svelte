<script lang="ts">
  import { page } from "$app/state";
  import { Button } from "$lib/components/ui/button/index.js";
  import type { LayoutData } from "./$types";

  let { data, children }: { data: LayoutData; children: import("svelte").Snippet } = $props();

  const sections = [
    { label: "Canvas", path: "canvas" },
    { label: "Timeline", path: "timeline" },
    { label: "Places", path: "places" },
    { label: "Expenses", path: "expenses" },
    { label: "Activity", path: "activity" },
    { label: "Members", path: "members" },
  ];

  function isActive(path: string) {
    return page.url.pathname.includes(`/trips/${data.trip.id}/${path}`);
  }
</script>

<div class="flex min-h-full flex-col">
  <header class="border-b border-border bg-card/80 backdrop-blur">
    <div class="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <div class="min-w-0">
        <a href={`/trips/${data.trip.id}/canvas`} class="block truncate text-lg font-semibold tracking-tight hover:text-primary">{data.trip.name}</a>
        <p class="truncate text-xs text-muted-foreground">{data.trip.destination ?? "Shared trip"} · {data.member.displayName}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        {#if data.isOwner}
          <Button href={`/trips/${data.trip.id}/settings/invites`} variant="outline" size="sm">Invite</Button>
          <Button href={`/trips/${data.trip.id}/settings`} variant="ghost" size="sm">Settings</Button>
        {/if}
        <Button href="/dashboard" variant="ghost" size="sm">All trips</Button>
      </div>
    </div>
    <nav aria-label="Trip sections" class="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
      {#each sections as section}
        <a href={`/trips/${data.trip.id}/${section.path}`} class={`whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors ${isActive(section.path) ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`} aria-current={isActive(section.path) ? "page" : undefined}>{section.label}</a>
      {/each}
    </nav>
  </header>
  <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
    {@render children()}
  </main>
</div>
