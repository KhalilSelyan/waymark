<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	const sessionQuery = authClient.useSession();

	async function handleSignOut() {
		await authClient.signOut({
		fetchOptions: {
			onSuccess: () => {
				goto('/');
			},
			onError: (error) => {
				console.error('Sign out failed:', error);
			}
		}
		});
	}

	function goToLogin() {
		goto('/login');
	}

</script>

<div class="relative">
	{#if $sessionQuery.isPending}
		<div class="h-8 w-24 animate-pulse rounded bg-neutral-700"></div>
	{:else if $sessionQuery.data?.user}
		{@const user = $sessionQuery.data.user}
		<div class="flex items-center gap-3">
			<span class="hidden font-mono text-[10px] uppercase tracking-wider text-neutral-500 sm:inline" title={user.email}>
				{user.name || user.email?.split('@')[0] || 'User'}
			</span>
			<button
				onclick={handleSignOut}
				class="rounded border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400 transition hover:border-rose-300/40 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
			>
				Sign Out
			</button>
		</div>
	{:else}
		<div class="flex items-center gap-2">
			<button
				onclick={goToLogin}
				class="rounded border border-sky-300/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-sky-300 transition hover:bg-sky-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
			>
				Sign In
			</button>
		</div>
	{/if}
</div>
