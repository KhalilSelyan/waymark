<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { client } from "$lib/orpc";
  import { Card, CardContent } from "$lib/components/ui/card/index.js";

  type ActivityRow = Awaited<ReturnType<typeof client.activity.list>>[number];
  let events = $state<ActivityRow[]>([]);
  let loading = $state(true);
  let loadingMore = $state(false);
  let hasMore = $state(true);
  let error = $state<string | null>(null);
  const tripId = $derived(page.params.tripId ?? "");

  onMount(async () => {
    try { events = await client.activity.list({ tripId, limit: 50 }); hasMore = events.length === 50; }
    catch (caught) { error = caught instanceof Error ? caught.message : "Activity could not be loaded."; }
    finally { loading = false; }
  });

  async function loadMore() {
    const last = events.at(-1);
    if (!last || loadingMore || !hasMore) return;
    loadingMore = true;
    try {
      const next = await client.activity.list({ tripId, limit: 50, before: new Date(last.event.createdAt).toISOString(), beforeId: last.event.id });
      events = [...events, ...next];
      hasMore = next.length === 50;
    } catch (caught) { error = caught instanceof Error ? caught.message : "More activity could not be loaded."; }
    finally { loadingMore = false; }
  }

  function description(row: ActivityRow) {
    const labels: Record<string, string> = { "canvas.object.created": "added a planning object", "canvas.object.updated": "updated a planning object", "canvas.object.deleted": "removed a planning object", "place.created": "added a place", "place.updated": "updated a place", "place.archived": "archived a place", "itinerary.created": "added an itinerary item", "expense.created": "recorded an expense", "expense.updated": "updated an expense", "expense.deleted": "deleted an expense" };
    return labels[row.event.eventType] ?? row.event.eventType.replaceAll(".", " ");
  }
</script>

<svelte:head><title>Activity · {page.data.trip.name}</title></svelte:head>
<section class="space-y-6"><header><p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Activity</p><h1 class="mt-2 text-3xl font-semibold">See what changed.</h1><p class="mt-2 text-muted-foreground">Important trip decisions and updates, in chronological order.</p></header>
  {#if error}<div class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div>{/if}
  {#if loading}<p class="text-sm text-muted-foreground">Loading activity...</p>{:else if events.length === 0}<Card class="border-dashed"><CardContent class="py-12 text-center text-sm text-muted-foreground">Activity will appear as the group makes changes.</CardContent></Card>{:else}<div class="space-y-3">{#each events as row}<Card><CardContent class="flex items-start justify-between gap-4 py-4"><div><p class="text-sm"><strong>{row.actor}</strong> {description(row)}</p><p class="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.event.createdAt))}</p></div><span class="font-mono text-[10px] uppercase text-muted-foreground">v{row.event.version}</span></CardContent></Card>{/each}{#if hasMore}<button class="w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-accent" disabled={loadingMore} onclick={() => void loadMore()}>{loadingMore ? "Loading..." : "Load more activity"}</button>{/if}</div>{/if}
</section>
