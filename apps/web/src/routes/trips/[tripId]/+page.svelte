<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<main class="mx-auto max-w-4xl px-6 py-16"><p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Trip workspace</p><h1 class="mt-3 text-4xl font-semibold">{data.trip.name}</h1><p class="mt-3 text-muted-foreground">You are in. The shared planning workspace is next.</p><Button class="mt-8" href={`/trips/${data.trip.id}/settings`}>Trip settings</Button></main>
