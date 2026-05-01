<script lang="ts">
	import type { PageData, ActionData } from './$types.js';
	import { enhance } from '$app/forms';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let manualCode = $state('');

	function goToCode() {
		const c = manualCode.trim();
		if (c) window.location.href = `/join?code=${encodeURIComponent(c)}`;
	}
</script>

<svelte:head><title>Вступить в семью — MealPlaniX</title></svelte:head>

<div
	class="flex min-h-screen items-center justify-center px-4"
	style="background: var(--color-bg-page);"
>
	<div class="w-full max-w-sm">
		<div
			class="rounded-xl p-6"
			style="background: var(--color-bg-card); border: 1px solid var(--color-border); box-shadow: var(--shadow-card);"
		>
			<p
				class="mb-1 font-bold"
				style="font-size: 20px; color: var(--color-text-primary); letter-spacing: -0.02em;"
			>
				Вступить в семью
			</p>

			{#if form?.error}
				<p
					class="mt-3 rounded-lg px-3 py-2 text-sm"
					style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);"
				>
					{form.error}
				</p>
			{/if}

			{#if data.invalidCode}
				<p class="mt-3 mb-4 text-sm" style="color: var(--color-error);">
					Код недействителен или устарел. Введи актуальный код ниже или попроси владельца поделиться ссылкой заново.
				</p>
				<!-- Ввод кода вручную -->
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={manualCode}
						placeholder="Например: A1B2C3D4"
						class="brand-input flex-1"
						style="text-transform: uppercase; letter-spacing: 0.1em; font-family: monospace;"
						oninput={(e) => { manualCode = (e.target as HTMLInputElement).value.toUpperCase(); }}
						onkeydown={(e) => { if (e.key === 'Enter') goToCode(); }}
					/>
					<button
						type="button"
						onclick={goToCode}
						disabled={!manualCode.trim()}
						class="btn-primary"
						style="width: auto; padding: 0 16px; opacity: {manualCode.trim() ? '1' : '0.45'};"
					>
						Найти
					</button>
				</div>
				<a href="/" class="mt-4 block text-center text-sm" style="color: var(--color-text-muted);">
					На главную
				</a>
			{:else if data.alreadyMember}
				<div
					class="mt-4 rounded-lg px-4 py-3"
					style="background: var(--color-green-tint); border: 1px solid var(--color-green-tint-border);"
				>
					<p class="text-sm font-semibold" style="color: var(--color-green-primary);">
						Вы уже участник этой семьи
					</p>
				</div>
				<a href="/" class="mt-4 block text-center text-sm" style="color: var(--color-accent);">
					На главную
				</a>
			{:else if form?.requestSent || (data.hasPendingRequest && !form?.error)}
				<div
					class="mt-4 rounded-lg px-4 py-3"
					style="background: var(--color-green-tint); border: 1px solid var(--color-green-tint-border);"
				>
					<p class="text-sm font-semibold" style="color: var(--color-green-primary);">
						Заявка отправлена
					</p>
					<p class="mt-0.5 text-sm" style="color: var(--color-text-muted);">
						Ожидайте одобрения владельцем семьи.
					</p>
				</div>
				<a href="/" class="mt-4 block text-center text-sm" style="color: var(--color-accent);">
					На главную
				</a>
			{:else if data.household}
				<p class="mt-2 text-sm" style="color: var(--color-text-muted);">
					Вы собираетесь отправить заявку на вступление в семью.
				</p>

				<div
					class="mt-4 flex flex-col gap-2 rounded-lg px-4 py-3"
					style="background: var(--color-bg-page); border: 1px solid var(--color-border);"
				>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold" style="color: var(--color-text-muted);"
							>ID семьи</span
						>
						<span class="font-mono text-sm" style="color: var(--color-text-primary);">
							…{data.household.id.slice(-8)}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold" style="color: var(--color-text-muted);"
							>Участников</span
						>
						<span class="text-sm font-semibold" style="color: var(--color-text-primary);">
							{data.memberCount}
						</span>
					</div>
				</div>

				<form method="POST" action="?/joinRequest" use:enhance class="mt-4">
					<input type="hidden" name="household_id" value={data.household.id} />
					<button type="submit" class="btn-primary" style="width: 100%;"> Отправить заявку </button>
				</form>

				<a href="/" class="mt-3 block text-center text-sm" style="color: var(--color-text-muted);">
					Отмена
				</a>
			{/if}
		</div>
	</div>
</div>
