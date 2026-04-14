<script lang="ts">
	import type { PageData } from './$types.js';

	let { data } = $props<{ data: PageData }>();

	let activeTab = $state<'login' | 'register'>('login');
	let email = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let loading = $state(false);

	// ── Восстановление пароля ─────────────────────────────────
	let showForgot = $state(false);
	let forgotEmail = $state('');
	let forgotLoading = $state(false);
	let forgotSent = $state(false);
	let forgotError = $state('');

	async function handleLogin() {
		errorMsg = '';
		loading = true;
		const { error } = await data.supabase.auth.signInWithPassword({ email, password });
		loading = false;
		if (error) {
			errorMsg = getErrorMessage(error.message);
		} else {
			const params = new URLSearchParams(window.location.search);
			const raw = params.get('redirect') ?? '/';
			const to = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
			window.location.replace(to);
		}
	}

	async function handleRegister() {
		errorMsg = '';
		loading = true;
		const { error } = await data.supabase.auth.signUp({ email, password });
		loading = false;
		if (error) {
			errorMsg = getErrorMessage(error.message);
		} else {
			const params = new URLSearchParams(window.location.search);
			const raw = params.get('redirect') ?? '/';
			const to = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
			window.location.replace(to);
		}
	}

	async function handleForgot() {
		forgotLoading = true;
		forgotError = '';
		const origin = window.location.origin;
		const { error } = await data.supabase.auth.resetPasswordForEmail(forgotEmail, {
			redirectTo: `${origin}/auth/reset`
		});
		forgotLoading = false;
		if (error) {
			forgotError = error.message;
		} else {
			forgotSent = true;
		}
	}

	function openForgot() {
		showForgot = true;
		forgotEmail = email; // prefill if already typed
		forgotSent = false;
		forgotError = '';
	}

	function closeForgot() {
		showForgot = false;
		forgotSent = false;
		forgotEmail = '';
		forgotError = '';
	}

	function getErrorMessage(msg: string): string {
		if (msg.includes('Invalid login credentials'))
			return 'Неверная почта или пароль. Попробуй ещё раз?';
		if (msg.includes('User already registered')) return 'Такая почта уже зарегистрирована. Войди?';
		if (msg.includes('Password should be at least'))
			return 'Пароль должен быть не менее 6 символов';
		if (msg.includes('Unable to validate email')) return 'Неверный формат почты';
		return msg;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			if (activeTab === 'login') handleLogin();
			else handleRegister();
		}
	}
</script>

<svelte:head><title>Войти — MealPlaniX</title></svelte:head>

<div
	class="flex min-h-screen items-center justify-center px-4"
	style="background: var(--color-bg-page);"
>
	<div class="w-full max-w-sm">
		<!-- Логотип -->
		<div class="mb-8 text-center">
			<img
				src="/favicon.png"
				alt="MealPlaniX"
				class="mx-auto mb-3"
				style="width: 56px; height: 56px;"
			/>
			<p
				class="mb-1 font-bold"
				style="font-size: 24px; color: var(--color-text-primary); letter-spacing: -0.03em;"
			>
				MealPlani<span style="color: var(--color-orange-accent);">X</span>
			</p>
			<p class="text-sm" style="color: var(--color-text-muted);">Планировщик семейного меню</p>
		</div>

		<!-- Карточка -->
		<div
			style="background: var(--color-bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-card); border: 1px solid var(--color-border); overflow: hidden;"
		>
			{#if showForgot}
				<!-- ── Форма восстановления пароля ── -->
				<div class="flex flex-col gap-4 p-6">
					<div>
						<button
							onclick={closeForgot}
							class="mb-4 flex cursor-pointer items-center gap-1.5 text-sm"
							style="color: var(--color-text-muted); background: none; border: none; padding: 0;"
						>
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
								<path
									d="M9 2L4 7l5 5"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
							Назад
						</button>

						<p
							class="mb-1 font-semibold"
							style="font-size: 15px; color: var(--color-text-primary);"
						>
							Восстановление пароля
						</p>
						<p class="text-sm" style="color: var(--color-text-muted);">
							Отправим ссылку для сброса на твою почту
						</p>
					</div>

					{#if forgotSent}
						<div
							class="rounded-lg px-4 py-3"
							style="background: var(--color-green-tint); border: 1px solid var(--color-green-tint-border);"
						>
							<p class="text-sm font-semibold" style="color: var(--color-green-primary);">
								Ссылка отправлена
							</p>
							<p class="mt-0.5 text-sm" style="color: var(--color-text-muted);">
								Проверь почту <strong>{forgotEmail}</strong> — в письме есть ссылка для сброса пароля.
							</p>
						</div>
						<button onclick={closeForgot} class="btn-secondary">Вернуться ко входу</button>
					{:else}
						<div>
							<label
								for="forgot-email"
								class="mb-1.5 block text-xs font-semibold"
								style="color: var(--color-text-primary);"
							>
								Почта
							</label>
							<input
								id="forgot-email"
								type="email"
								bind:value={forgotEmail}
								oninput={() => (forgotError = '')}
								placeholder="katya@example.com"
								class="brand-input"
							/>
						</div>
						{#if forgotError}
							<p
								class="rounded-lg px-3 py-2 text-sm"
								style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);"
							>
								{forgotError}
							</p>
						{/if}
						<button
							onclick={handleForgot}
							disabled={forgotLoading || !forgotEmail}
							class="btn-primary flex items-center justify-center gap-2"
						>
							{#if forgotLoading}<span
									class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
								></span>{/if}
							{forgotLoading ? 'Отправляем...' : 'Отправить ссылку'}
						</button>
					{/if}
				</div>
			{:else}
				<!-- ── Обычная форма входа/регистрации ── -->

				<!-- Табы -->
				<div class="flex" style="border-bottom: 1px solid var(--color-border);">
					{#each [{ id: 'login', label: 'Войти' }, { id: 'register', label: 'Регистрация' }] as tab (tab.id)}
						<button
							onclick={() => {
								activeTab = tab.id as 'login' | 'register';
								errorMsg = '';
							}}
							class="flex-1 cursor-pointer py-3 text-sm font-semibold transition-colors"
							style="
                color: {activeTab === tab.id
								? 'var(--color-green-primary)'
								: 'var(--color-text-muted)'};
                background: {activeTab === tab.id
								? 'var(--color-bg-card)'
								: 'var(--color-bg-page)'};
                border-bottom: {activeTab === tab.id
								? '2px solid var(--color-green-primary)'
								: '2px solid transparent'};
              "
							onmouseenter={(e) => {
								if (activeTab !== tab.id)
									(e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
							}}
							onmouseleave={(e) => {
								if (activeTab !== tab.id)
									(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
							}}
						>
							{tab.label}
						</button>
					{/each}
				</div>

				<!-- Форма -->
				<div class="flex flex-col gap-4 p-6">
					<div>
						<label
							for="email"
							class="mb-1.5 block text-xs font-semibold"
							style="color: var(--color-text-primary);"
						>
							Почта
						</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							onkeydown={handleKeydown}
							placeholder="katya@example.com"
							class="brand-input"
						/>
					</div>

					<div>
						<label
							for="password"
							class="mb-1.5 block text-xs font-semibold"
							style="color: var(--color-text-primary);"
						>
							Пароль
						</label>
						<input
							id="password"
							type="password"
							bind:value={password}
							onkeydown={handleKeydown}
							placeholder="Не менее 6 символов"
							class="brand-input"
						/>
						{#if activeTab === 'login'}
							<button
								onclick={openForgot}
								class="mt-1.5 cursor-pointer text-xs"
								style="color: var(--color-text-muted); background: none; border: none; padding: 0; text-decoration: underline; text-underline-offset: 2px;"
								onmouseenter={(e) => {
									(e.currentTarget as HTMLElement).style.color = 'var(--color-green-primary)';
								}}
								onmouseleave={(e) => {
									(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
								}}
							>
								Забыли пароль?
							</button>
						{/if}
					</div>

					{#if errorMsg}
						<p
							class="rounded-lg px-3 py-2 text-sm"
							style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);"
						>
							{errorMsg}
						</p>
					{/if}

					{#if activeTab === 'login'}
						<button
							onclick={handleLogin}
							disabled={loading}
							class="btn-primary flex items-center justify-center gap-2"
						>
							{#if loading}<span
									class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
								></span>{/if}
							{loading ? 'Входим...' : 'Войти'}
						</button>
					{:else}
						<button
							onclick={handleRegister}
							disabled={loading}
							class="btn-primary flex items-center justify-center gap-2"
						>
							{#if loading}<span
									class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
								></span>{/if}
							{loading ? 'Создаём аккаунт...' : 'Создать аккаунт'}
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
