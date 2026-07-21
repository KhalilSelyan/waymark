<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import type { ActionData, PageData } from "./$types";
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<main class="flex min-h-full items-center justify-center px-6 py-16"><Card class="w-full max-w-md"><CardHeader><p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Trip invite</p><CardTitle>Join {data.trip.name}</CardTitle><p class="text-sm text-muted-foreground">{data.trip.destination ?? "A shared Waymark trip"}</p></CardHeader><CardContent><form method="POST" use:enhance class="grid gap-5"><label class="grid gap-2" for="username"><Label>Username</Label><Input id="username" name="username" required minlength={3} maxlength={24} /></label><label class="grid gap-2" for="displayName"><Label>Display name</Label><Input id="displayName" name="displayName" required /></label>{#if form?.error}<p class="text-sm text-destructive" role="alert">{form.error}</p>{/if}<Button type="submit">Join trip</Button></form></CardContent></Card></main>
