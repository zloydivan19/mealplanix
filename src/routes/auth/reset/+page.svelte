<script lang="ts">
	import type { PageData } from './$types.js';

	let { data } = $props<{ data: PageData }>();

	let pwNew = $state('');
	let pwConfirm = $state('');
	let submitting = $state(false);
	let errorMsg = $state('');
	let sessionReady = $state(false);
	let invalidLink = $state(false);

	// Supabase sends the session via URL hash after the user clicks the reset link.
	// onAuthStateChange fires PASSWORD_RECOVERY — that's when the session is set.
	$effect(() => {
		data.supabase.auth.getSession().then(({ data: { session } }: { data: { session: import('@supabase/supabase-js').Session | null } }) => {
			if (session) sessionReady = true;
		});

		const { data: { subscription } } = data.supabase.auth.onAuthStateChange((event: import('@supabase/supabase-js').AuthChangeEvent) => {
			if (event === 'PASSWORD_RECOVERY') {
				sessionReady = true;
				invalidLink = false;
			}
		});

		const timer = setTimeout(() => {
			if (!sessionReady) invalidLink = true;
		}, 5000);

		return () => {
			subscription.unsubscribe();
			clearTimeout(timer);
		};
	});

	async function handleSubmit() {
		errorMsg = '';

		if (!pwNew || pwNew.length < 6) {
			errorMsg = 'Пароль должен быть не менее 6 символов';
			return;
		}
		if (pwNew !== pwConfirm) {
			errorMsg = 'Пароли не совпадают';
			return;
		}

		submitting = true;
		const { error } = await data.supabase.auth.updateUser({ password: pwNew });
		submitting = false;

		if (error) {
			errorMsg = 'Не удалось обновить пароль. Ссылка устарела — запроси новую.';
		} else {
			window.location.replace('/');
		}
	}
</script>

<svelte:head><title>Сброс пароля — MealPlaniX</title></svelte:head>

<div
	class="flex min-h-screen items-center justify-center px-4"
	style="background: var(--color-bg-page);"
>
	<div class="w-full max-w-sm">
		<!-- Логотип -->
		<div class="mb-8 text-center">
			<img
				src="/logo1.jpg"
				alt="MealPlaniX"
				class="mx-auto mb-3"
				style="height: 80px; object-fit: contain; mix-blend-mode: multiply;"
			/>
			<p
				class="mb-1 font-bold"
				style="font-size: 24px; color: var(--color-text-primary); letter-spacing: -0.03em;"
			>
				MealPlani<span style="color: var(--color-orange-accent);">X</span>
			</p>
			<p class="text-sm" style="color: var(--color-text-muted);">Планировщик семейного меню</p>
		</div>

		<div
			style="background: var(--color-bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-card); border: 1px solid var(--color-border); overflow: hidden;"
		>
			<div class="flex flex-col gap-4 p-6">
				<div>
					<p class="mb-1 font-semibold" style="font-size: 15px; color: var(--color-text-primary);">
						Новый пароль
					</p>
					<p class="text-sm" style="color: var(--color-text-muted);">
						Придумай новый пароль для аккаунта
					</p>
				</div>

				{#if invalidLink}
					<div
						class="rounded-lg px-4 py-3"
						style="background: var(--color-error-bg); border: 1px solid var(--color-error-border);"
					>
						<p class="text-sm font-semibold" style="color: var(--color-error);">Ссылка устарела</p>
						<p class="mt-0.5 text-sm" style="color: var(--color-text-muted);">
							Запроси новую ссылку для сброса пароля.
						</p>
					</div>
					<button onclick={() => window.location.replace('/auth')} class="btn-secondary"
						>Вернуться ко входу</button
					>
				{:else if !sessionReady}
					<div class="flex items-center justify-center gap-2 py-4">
						<span
							class="inline-block h-5 w-5 animate-spin rounded-full border-2"
							style="border-color: var(--color-border); border-top-color: var(--color-green-primary);"
						></span>
						<span class="text-sm" style="color: var(--color-text-muted);">Проверяем ссылку...</span>
					</div>
				{:else}
					<div>
						<label
							for="pw-new"
							class="mb-1.5 block text-xs font-semibold"
							style="color: var(--color-text-primary);">Новый пароль</label
						>
						<input
							id="pw-new"
							type="password"
							bind:value={pwNew}
							placeholder="Не менее 6 символов"
							class="brand-input {errorMsg ? 'error' : ''}"
						/>
					</div>

					<div>
						<label
							for="pw-confirm"
							class="mb-1.5 block text-xs font-semibold"
							style="color: var(--color-text-primary);">Повтор пароля</label
						>
						<input
							id="pw-confirm"
							type="password"
							bind:value={pwConfirm}
							placeholder="Повтори новый пароль"
							class="brand-input {errorMsg ? 'error' : ''}"
						/>
					</div>

					{#if errorMsg}
						<p
							class="rounded-lg px-3 py-2 text-sm"
							style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);"
						>
							{errorMsg}
						</p>
					{/if}

					<button
						onclick={handleSubmit}
						disabled={submitting}
						class="btn-primary flex items-center justify-center gap-2"
					>
						{#if submitting}<span
								class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
							></span>{/if}
						{submitting ? 'Сохраняем...' : 'Сохранить пароль'}
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
