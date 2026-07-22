<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";

  const pillars = [
    { icon: "✎", title: "Sketch the plan", text: "Drop links, pins, and ideas onto a shared canvas. Everyone can contribute." },
    { icon: "□", title: "Make it actionable", text: "Turn loose ideas into a structured itinerary with dates, times, and places." },
    { icon: "↗", title: "Keep money clear", text: "Track who paid for what and let Waymark calculate the simplest way to settle." },
    { icon: "◌", title: "Stay in sync", text: "Presence, live cursors, and activity history keep the whole group aligned." },
  ];
</script>

<svelte:head>
  <title>Waymark · Plan the trip together</title>
  <meta name="description" content="A shared workspace for trip ideas, itineraries, places, and expenses." />
</svelte:head>

<div class="min-h-full overflow-hidden bg-neutral-950 text-neutral-100">
  <header class="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-neutral-950/80 backdrop-blur-md">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <div class="flex items-center gap-8"><a href="/" class="font-mono text-lg font-bold tracking-[-0.08em]">WAYMARK</a><nav class="hidden gap-6 text-xs text-neutral-400 md:flex"><a class="transition hover:text-sky-300" href="#product">Product</a><a class="transition hover:text-sky-300" href="#workflow">How it works</a><a class="transition hover:text-sky-300" href="#money">Expenses</a></nav></div>
      <div class="flex items-center gap-3"><Button href="/login" variant="ghost" size="sm">Sign in</Button><Button href="/trips/new" size="sm">Create a trip</Button></div>
    </div>
  </header>

  <main class="mx-auto flex max-w-7xl flex-col gap-28 px-4 pb-24 pt-32 sm:px-6 lg:px-8">
    <section class="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center pt-10">
      <span class="border border-sky-300/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300">Plan together</span>
      <h1 class="max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.06em] sm:text-6xl">The trip plan your whole group can actually use.</h1>
      <p class="max-w-2xl text-sm leading-7 text-neutral-400 sm:text-base">Turn messy group chats and scattered ideas into one clear workspace for plans, places, schedules, and shared costs.</p>
      <div class="flex flex-wrap justify-center gap-3 pt-2"><Button href="/trips/new" size="lg">Create a trip</Button><Button href="#product" variant="outline" size="lg">See how it works</Button></div>
    </section>

    <section id="product" class="relative overflow-hidden border border-white/10 bg-[#0e0e11] shadow-2xl shadow-sky-950/20">
      <div class="pointer-events-none absolute inset-0 opacity-40" style="background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:24px 24px"></div>
      <div class="relative grid min-h-[34rem] md:grid-cols-[15rem_1fr]">
        <aside class="hidden border-r border-white/10 bg-black/20 md:block"><div class="border-b border-white/10 p-4 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">Itinerary · Lisbon</div><div class="space-y-2 p-3"><p class="px-1 pt-2 font-mono text-[10px] text-sky-300">DAY 1 · THU OCT 12</p>{#each [["14:30","Arrival LIS"],["16:00","Check-in Alfama"],["20:00","Dinner at Ramiro"]] as item, i}<div class={`border p-3 ${i === 0 ? "border-sky-300/50 bg-sky-300/5" : "border-white/10 bg-white/[.02]"}`}><p class="font-mono text-xs">{item[1]}</p><p class="mt-1 font-mono text-[10px] text-neutral-500">{item[0]} · Lisbon</p></div>{/each}</div></aside>
        <div class="relative p-5 sm:p-10">
          <div class="flex items-center justify-between border-b border-white/10 pb-4"><span class="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">Shared planning board</span><span class="font-mono text-[10px] text-emerald-300">● 3 online</span></div>
          <div class="relative h-[27rem]">
            <article class="absolute left-[8%] top-[16%] w-56 rotate-[-3deg] border border-white/15 bg-[#1b1b1e] p-4 shadow-2xl"><div class="flex justify-between font-mono text-[10px] uppercase tracking-widest text-neutral-500"><span>Idea</span><span>⌖</span></div><p class="mt-5 text-sm leading-6 text-neutral-200">Time Out Market for lunch on Friday?</p><p class="mt-5 font-mono text-[10px] text-sky-300">Nora · just now</p></article>
            <article class="absolute right-[8%] top-[28%] w-64 rotate-[2deg] border border-white/15 bg-[#1f1f22] p-4 shadow-2xl"><div class="flex items-center gap-2 border-b border-white/10 pb-3"><span class="text-sky-300">●</span><span class="text-sm font-semibold">Pastéis de Belém</span></div><div class="mt-4 flex h-24 items-end bg-gradient-to-br from-amber-900/70 via-orange-800/30 to-neutral-900 p-3"><span class="font-mono text-[10px] uppercase tracking-widest text-amber-200">Place · must-do</span></div><p class="mt-3 font-mono text-[10px] text-neutral-500">map link · saved by Khalil</p></article>
            <div class="absolute bottom-8 left-1/2 -translate-x-1/2 border border-rose-300/25 bg-[#1b1b1e] px-4 py-3 shadow-xl"><p class="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Group balance</p><p class="mt-1 font-mono text-sm text-rose-300">You owe €40.00</p></div>
            <div class="absolute left-[58%] top-[22%] text-amber-300"><span class="text-xl">◢</span><span class="ml-1 bg-amber-300 px-1.5 py-0.5 font-mono text-[9px] text-neutral-950">Khalil</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="grid gap-3 md:grid-cols-4">{#each pillars as pillar}<article class="border border-white/10 bg-white/[.025] p-5 transition hover:border-sky-300/40"><span class="font-mono text-2xl text-sky-300">{pillar.icon}</span><h2 class="mt-6 text-base font-semibold">{pillar.title}</h2><p class="mt-3 text-xs leading-6 text-neutral-500">{pillar.text}</p></article>{/each}</section>

    <section id="workflow" class="space-y-8"><div class="text-center"><span class="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300">How it works</span><h2 class="mt-4 text-3xl font-bold tracking-[-0.04em]">From loose idea to shared plan.</h2></div><div class="grid gap-3 md:grid-cols-4">{#each [["01","Capture idea"],["02","Save place"],["03","Confirm itinerary"],["04","Split cost"]] as step, i}<div class="relative border border-white/10 bg-[#1b1b1e] p-5"><span class="font-mono text-xs text-sky-300">{step[0]}</span><h3 class="mt-10 font-semibold">{step[1]}</h3>{#if i < 3}<span class="absolute right-[-13px] top-1/2 z-10 hidden text-neutral-600 md:block">→</span>{/if}</div>{/each}</div></section>

    <section id="money" class="grid items-center gap-12 md:grid-cols-2"><div><span class="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300">Shared expenses</span><h2 class="mt-4 text-3xl font-bold tracking-[-0.04em]">No more spreadsheet math.</h2><p class="mt-5 text-sm leading-7 text-neutral-400">Log expenses on the go, choose equal or custom shares, and see the smallest practical path to settle up.</p></div><div class="border border-white/10 bg-[#0e0e11] p-5"><div class="flex justify-between border-b border-white/10 pb-4"><span class="font-semibold">Dinner at Ramiro</span><span class="font-mono text-sky-300">€120.00</span></div><div class="space-y-3 py-5 font-mono text-xs text-neutral-400"><p class="flex justify-between"><span>Paid by</span><strong class="text-neutral-200">Khalil</strong></p><p class="flex justify-between"><span>Split</span><strong class="text-neutral-200">4 people · evenly</strong></p></div><div class="border border-sky-300/20 bg-sky-300/5 p-4"><p class="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Suggested settlement</p><p class="mt-2 flex justify-between font-mono text-sm"><span>Nora pays Khalil</span><span class="text-sky-300">€30.00</span></p></div></div></section>

    <section class="border-t border-white/10 py-20 text-center"><span class="font-mono text-[10px] uppercase tracking-[0.25em] text-sky-300">Ready when the group is</span><h2 class="mx-auto mt-5 max-w-2xl text-3xl font-bold tracking-[-0.05em] sm:text-5xl">Plan the trip together. Track the money automatically.</h2><Button href="/trips/new" size="lg" class="mt-8">Create your trip</Button></section>
  </main>
  <footer class="border-t border-white/10 bg-[#0e0e11] px-4 py-8 sm:px-6"><div class="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row"><div><a href="/" class="font-mono font-bold tracking-[-0.08em]">WAYMARK</a><p class="mt-2 font-mono text-[10px] text-neutral-600">Plan together. Track the money automatically.</p></div><nav class="flex gap-5 font-mono text-[10px] uppercase tracking-widest text-neutral-500"><a href="/login" class="hover:text-sky-300">Sign in</a><a href="#product" class="hover:text-sky-300">Product</a><a href="#money" class="hover:text-sky-300">Expenses</a></nav></div></footer>
</div>
