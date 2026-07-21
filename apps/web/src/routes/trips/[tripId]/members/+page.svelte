<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
</script>

<main class="mx-auto max-w-3xl px-6 py-12"><div class="mb-8 space-y-3"><p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Trip members</p><h1 class="text-4xl font-semibold">{data.trip.name}</h1></div><Card><CardHeader><CardTitle>People in this trip</CardTitle></CardHeader><CardContent class="space-y-3">{#each data.members as entry}<div class="flex items-center justify-between gap-4 rounded-md border border-border p-3"><div><p class="font-medium">{entry.profile?.username ?? entry.guest?.username ?? entry.member.displayName}</p><p class="text-xs text-muted-foreground">{entry.member.role}</p></div>{#if data.member.role === "owner" && entry.member.role !== "owner"}<form method="POST" action="?/remove" use:enhance><input type="hidden" name="memberId" value={entry.member.id} /><Button size="sm" variant="destructive">Remove</Button></form>{/if}</div>{/each}</CardContent></Card>{#if data.member.role !== "owner"}<form method="POST" action="?/leave" use:enhance class="mt-6"><Button variant="outline">Leave trip</Button></form>{/if}</main>
