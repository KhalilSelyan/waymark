<script lang="ts">
  import { page } from "$app/state";
  import UserMenu from "./UserMenu.svelte";
</script>

<header class="border-b border-white/10 bg-neutral-950/90 backdrop-blur-md">
  <div class="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
    <div class="flex min-w-0 items-center gap-8">
      <a href="/" class="shrink-0 font-mono text-lg font-bold tracking-[-0.08em]">WAYMARK</a>
      <nav class="hidden items-center gap-5 text-xs text-neutral-500 sm:flex" aria-label="Primary navigation">
        <a class="transition hover:text-sky-300" class:text-sky-300={page.url.pathname === "/dashboard"} href="/dashboard">Trips</a>
        <a class="transition hover:text-sky-300" href="/trips/new">New trip</a>
      </nav>
    </div>
    <UserMenu />
  </div>
</header>
