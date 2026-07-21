<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Trips | Waymark</title></svelte:head>

<main class="mx-auto max-w-6xl px-6 py-12">
  <header class="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
    <div class="space-y-3">
      <p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Dashboard</p>
      <h1 class="text-4xl font-semibold tracking-tight">Your trips</h1>
      <p class="text-muted-foreground">Plan together, then keep the money clear.</p>
    </div>
    <Button href="/trips/new">Create trip</Button>
  </header>

  {#if data.trips.length === 0}
    <Card class="border-dashed">
      <CardContent class="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
        <div class="space-y-2"><h2 class="text-xl font-medium">No trips yet.</h2><p class="max-w-sm text-sm text-muted-foreground">Start a shared workspace for your next adventure.</p></div>
        <Button href="/trips/new">Create your first trip</Button>
      </CardContent>
    </Card>
  {:else}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each data.trips as item}
        <a href={`/trips/${item.trip.id}`} class="group">
          <Card class="h-full transition-colors group-hover:border-primary/60">
            <CardHeader><p class="font-mono text-xs uppercase tracking-wider text-muted-foreground">{item.role}</p><CardTitle>{item.trip.name}</CardTitle></CardHeader>
            <CardContent class="space-y-3 text-sm text-muted-foreground">
              {#if item.trip.destination}<p>{item.trip.destination}</p>{/if}
              <p>{item.trip.startsOn ?? "Flexible dates"}{#if item.trip.endsOn} → {item.trip.endsOn}{/if}</p>
              <p class="font-mono text-xs uppercase">{item.trip.currency} · {item.trip.timezone}</p>
            </CardContent>
          </Card>
        </a>
      {/each}
    </div>
  {/if}
</main>
