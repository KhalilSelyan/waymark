<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Trips · Waymark</title></svelte:head>

<main class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
  <header class="mb-10 flex flex-col justify-between gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end">
    <div><p class="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300">Workspace index</p><h1 class="mt-3 text-4xl font-bold tracking-[-0.06em]">Your trips</h1><p class="mt-3 max-w-md text-sm leading-6 text-neutral-500">Plan together, keep the decisions visible, and make the money clear.</p></div>
    <Button href="/trips/new">Create trip</Button>
  </header>

  {#if data.trips.length === 0}
    <Card class="border-dashed border-white/15 bg-white/[.02]"><CardContent class="flex min-h-64 flex-col items-center justify-center gap-5 text-center"><div><p class="font-mono text-2xl text-sky-300">[ ]</p><h2 class="mt-4 text-xl font-semibold">No trips yet.</h2><p class="mt-2 max-w-sm text-sm text-neutral-500">Start a shared workspace for the next place your group wants to go.</p></div><Button href="/trips/new">Create your first trip</Button></CardContent></Card>
  {:else}
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{#each data.trips as item}<a href={`/trips/${item.trip.id}`} class="group"><Card class="h-full border-white/10 bg-white/[.025] transition hover:-translate-y-0.5 hover:border-sky-300/40"><CardHeader><p class="font-mono text-[10px] uppercase tracking-[0.2em] text-sky-300">{item.role} · active</p><CardTitle class="mt-3 text-xl tracking-[-0.04em]">{item.trip.name}</CardTitle></CardHeader><CardContent class="space-y-3 text-sm text-neutral-500">{#if item.trip.destination}<p>{item.trip.destination}</p>{/if}<p>{item.trip.startsOn ?? "Flexible dates"}{#if item.trip.endsOn} → {item.trip.endsOn}{/if}</p><div class="flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-wider"><span>{item.trip.currency} · {item.trip.timezone}</span><span class="text-neutral-600 transition group-hover:text-sky-300">Open →</span></div></CardContent></Card></a>{/each}</div>
  {/if}
</main>
