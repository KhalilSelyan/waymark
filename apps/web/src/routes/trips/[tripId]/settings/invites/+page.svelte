<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card/index.js";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<main class="mx-auto max-w-3xl px-6 py-12">
  <div class="mb-8 space-y-3"><p class="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Invite people</p><h1 class="text-4xl font-semibold tracking-tight">Share this trip.</h1><p class="text-muted-foreground">Reusable links let guests join without creating an account.</p></div>
  <Card>
    <CardHeader><CardTitle>Invite links</CardTitle></CardHeader>
    <CardContent class="space-y-5">
      <form method="POST" action="?/create" use:enhance><Button type="submit">Create invite link</Button></form>
      {#if form?.inviteUrl}<div class="rounded-md border border-border bg-muted p-3 text-sm break-all">{form.inviteUrl}</div>{/if}
      <div class="space-y-3">
        {#each data.invites as invite}
           <div class="flex items-center justify-between gap-4 rounded-md border border-border p-3 text-sm"><span class="text-muted-foreground">Created {invite.createdAt.toLocaleString()} · Expires {invite.expiresAt?.toLocaleDateString() ?? "never"}</span>{#if invite.revokedAt}<span class="text-destructive">Revoked</span>{:else}<form method="POST" action="?/revoke" use:enhance><input type="hidden" name="inviteId" value={invite.id} /><Button type="submit" variant="outline" size="sm">Revoke</Button></form>{/if}</div>
        {/each}
      </div>
    </CardContent>
  </Card>
</main>
