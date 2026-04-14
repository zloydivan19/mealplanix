<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { calcKbju, ACTIVITY_LABELS } from '$lib/utils/kbju.js';
	import type {
		Persona,
		ActivityLevel,
		Formula,
		Gender,
		HouseholdMember,
		HouseholdJoinRequest
	} from '$lib/types/database.js';

	let persona = $derived(page.data.persona as Persona | null);
	let personas = $derived(page.data.personas as Persona[]);
	let currentUserId = $derived(page.data.user?.id as string | undefined);
	let saving = $state(false);
	let saved = $state(false);
	let errorMsg = $state('');

	// ── Создание персоны ──────────────────────────────────────
	let showCreateForm = $state(false);
	let newPersonaName = $state('');
	let newPersonaNoAccount = $state(false);
	let creating = $state(false);
	let createError = $state('');
	let createSuccess = $state(false);

	// ── Удаление персоны ──────────────────────────────────────
	let deletingId = $state<number | null>(null);
	let deleteError = $state('');

	// ── Редактирование локальной персоны ──────────────────────
	let editingLocalPersonaId = $state<number | null>(null);
	let editName = $state('');
	let editKcal = $state<number | ''>('');
	let editProtein = $state<number | ''>('');
	let editFat = $state<number | ''>('');
	let editCarbs = $state<number | ''>('');
	let editSaving = $state(false);
	let editError = $state('');

	function openEditForm(p: Persona) {
		editingLocalPersonaId = p.id;
		editName = p.name;
		editKcal = p.kcal_target ?? '';
		editProtein = p.protein_target ?? '';
		editFat = p.fat_target ?? '';
		editCarbs = p.carbs_target ?? '';
		editError = '';
	}

	function closeEditForm() {
		editingLocalPersonaId = null;
		editError = '';
	}

	// ── Безопасность ─────────────────────────────────────────
	let pwNew = $state('');
	let pwConfirm = $state('');
	let pwSaving = $state(false);
	let pwSuccess = $state(false);
	let pwError = $state('');

	// ── Моя семья ─────────────────────────────────────────────
	let members = $derived(page.data.members as HouseholdMember[]);
	let pendingRequests = $derived(page.data.pendingRequests as HouseholdJoinRequest[]);
	let isOwner = $derived(page.data.isOwner as boolean);
	let familyError = $state('');
	let inviteCodeState = $state((page.data.household?.invite_code as string | undefined) ?? '');
	let copyCodeSuccess = $state(false);
	let copyLinkSuccess = $state(false);
	let copyCodeTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let copyLinkTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let savedTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let createSuccessTimer = $state<ReturnType<typeof setTimeout> | null>(null);
	let pwSuccessTimer = $state<ReturnType<typeof setTimeout> | null>(null);

	$effect(() => {
		if (page.data.household?.invite_code) {
			inviteCodeState = page.data.household.invite_code as string;
		}
	});

	$effect(() => {
		return () => {
			if (copyCodeTimer) clearTimeout(copyCodeTimer);
			if (copyLinkTimer) clearTimeout(copyLinkTimer);
			if (savedTimer) clearTimeout(savedTimer);
			if (createSuccessTimer) clearTimeout(createSuccessTimer);
			if (pwSuccessTimer) clearTimeout(pwSuccessTimer);
		};
	});

	async function copyCode() {
		await navigator.clipboard.writeText(inviteCodeState);
		copyCodeSuccess = true;
		if (copyCodeTimer) clearTimeout(copyCodeTimer);
		copyCodeTimer = setTimeout(() => { copyCodeSuccess = false; copyCodeTimer = null; }, 2000);
	}

	async function copyLink() {
		await navigator.clipboard.writeText(`${window.location.origin}/join?code=${inviteCodeState}`);
		copyLinkSuccess = true;
		if (copyLinkTimer) clearTimeout(copyLinkTimer);
		copyLinkTimer = setTimeout(() => { copyLinkSuccess = false; copyLinkTimer = null; }, 2000);
	}

	// Инициализация напрямую из SSR-данных — без вспышки при первом рендере
	const _p = untrack(() => page.data.persona as Persona | null);
	const _r = _p?.meal_ratios as { bf: number; ln: number; dn: number } | null;

	// ── Данные профиля ────────────────────────────────────────
	let name = $state(_p?.name ?? '');
	let gender = $state<Gender>(_p?.gender ?? 'male');
	let age = $state<number | ''>(_p?.age ?? '');
	let weight = $state<number | ''>(_p?.weight ?? '');
	let height = $state<number | ''>(_p?.height ?? '');
	let activity = $state<ActivityLevel>(_p?.activity ?? 'moderate');
	let formula = $state<Formula>(_p?.formula ?? 'mifflin');
	let kcalOverride = $state<number | ''>('');

	// ── Настройки генерации ───────────────────────────────────
	let carryDinner = $state(_p?.carry_dinner_to_lunch ?? true);
	let matchKcal = $state(_p?.match_kcal ?? false);

	let bf = $state(_r?.bf ?? 25);
	let ln = $state(_r?.ln ?? 40);
	let dn = $state(_r?.dn ?? 35);

	// Реактивное обновление при смене персоны (навигация)
	$effect(() => {
		if (!persona) return;
		const r = persona.meal_ratios as { bf: number; ln: number; dn: number } | null;
		name = persona.name;
		gender = persona.gender ?? 'male';
		age = persona.age ?? '';
		weight = persona.weight ?? '';
		height = persona.height ?? '';
		activity = persona.activity ?? 'moderate';
		formula = persona.formula ?? 'mifflin';
		carryDinner = persona.carry_dinner_to_lunch ?? true;
		matchKcal = persona.match_kcal ?? false;
		bf = r?.bf ?? 25;
		ln = r?.ln ?? 40;
		dn = r?.dn ?? 35;
		kcalOverride = ''; // сброс ручной корректировки при смене персоны
	});

	let kbju = $derived.by(() => {
		if (!matchKcal) return null;
		if (!age || !weight || !height) return null;
		return calcKbju(
			gender,
			Number(age),
			Number(weight),
			Number(height),
			activity,
			formula,
			kcalOverride !== '' ? Number(kcalOverride) : null
		);
	});

	let ratioSum = $derived(bf + ln + dn);
	let ratioValid = $derived(ratioSum === 100);

	function handleKcalOverride(e: Event) {
		const v = (e.target as HTMLInputElement).valueAsNumber;
		kcalOverride = isNaN(v) ? '' : v;
	}

	async function save() {
		if (!persona) return;
		if (!name.trim()) {
			errorMsg = 'Нужно ввести имя';
			return;
		}
		if (matchKcal && !kbju) {
			errorMsg = 'Заполни возраст, вес и рост';
			return;
		}
		if (matchKcal && !ratioValid) {
			errorMsg = 'Сумма % по приёмам пищи должна быть 100';
			return;
		}

		saving = true;
		errorMsg = '';

		await page.data.supabase
			.from('personas')
			.update({
				name: name.trim(),
				gender,
				age: age !== '' ? Number(age) : null,
				weight: weight !== '' ? Number(weight) : null,
				height: height !== '' ? Number(height) : null,
				activity,
				formula,
				kcal_target: kbju?.kcal ?? null,
				protein_target: kbju?.protein ?? null,
				fat_target: kbju?.fat ?? null,
				carbs_target: kbju?.carbs ?? null,
				meal_ratios: matchKcal ? { bf, ln, dn } : { bf: 25, ln: 40, dn: 35 },
				carry_dinner_to_lunch: carryDinner,
				match_kcal: matchKcal
			})
			.eq('id', persona.id);

		saving = false;
		saved = true;
		if (savedTimer) clearTimeout(savedTimer);
		savedTimer = setTimeout(() => { saved = false; savedTimer = null; }, 2500);
	}
</script>

<svelte:head><title>Настройки — MealPlaniX</title></svelte:head>

<div class="flex min-h-screen flex-col" style="background: var(--color-bg-page);">
	<!-- Топбар 56px -->
	<div
		class="sticky top-0 flex items-center gap-3 px-4"
		style="height: 56px; background: var(--color-bg-card); border-bottom: 1px solid var(--color-border); z-index: 10;"
	>
		<a
			href="/"
			class="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
			style="color: var(--color-text-muted);"
			onmouseenter={(e) => {
				const el = e.currentTarget as HTMLElement;
				el.style.background = 'var(--color-bg-page)';
				el.style.color = 'var(--color-text-primary)';
			}}
			onmouseleave={(e) => {
				const el = e.currentTarget as HTMLElement;
				el.style.background = '';
				el.style.color = 'var(--color-text-muted)';
			}}
			aria-label="Назад"
		>
			<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
				<path
					d="M10 3L5 8l5 5"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</a>
		<h1
			class="font-semibold"
			style="font-size: 15px; color: var(--color-text-primary); letter-spacing: -0.01em;"
		>
			Настройки
		</h1>
	</div>

	<div class="mx-auto w-full max-w-lg px-4 py-6">
		<!-- ── РАЗДЕЛ: Персоны домохозяйства ────────────────────── -->
		<div
			class="mb-4 flex flex-col gap-0"
			style="background: var(--color-bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); border: 1px solid var(--color-border); overflow: hidden;"
		>
			<div class="px-5 pt-5 pb-4">
				<h2 class="mb-1 font-semibold" style="font-size: 16px; color: var(--color-text-primary);">
					Участники
				</h2>
				<p class="text-sm" style="color: var(--color-text-muted);">Персоны в твоём домохозяйстве</p>
			</div>

			<!-- Список персон -->
			{#each personas as p (p.id)}
				{@const isLocal = p.user_id === null}
				{@const canManage = isLocal && p.created_by_user_id === currentUserId}
				{@const isActive = p.id === persona?.id}
				{@const isEditing = editingLocalPersonaId === p.id}
				<div style="border-top: 1px solid var(--color-border);">
					<!-- Строка персоны -->
					<div style="padding: 12px 20px; display: flex; align-items: center; gap: 12px;">
						<!-- Аватар -->
						<div
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
							style="background: {isActive
								? 'var(--color-green-primary)'
								: 'var(--color-border)'}; color: {isActive
								? 'var(--color-text-inverse)'
								: 'var(--color-text-muted)'};"
						>
							{p.name.trim()[0]?.toUpperCase() ?? '?'}
						</div>

						<!-- Имя + бейдж -->
						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-sm font-semibold" style="color: var(--color-text-primary);"
								>{p.name}</span
							>
							{#if isLocal}
								<span
									class="inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold"
									style="background: var(--color-bg-page); color: var(--color-text-muted); border: 1px solid var(--color-border);"
								>
									<svg
										width="10"
										height="10"
										viewBox="0 0 10 10"
										fill="none"
										style="flex-shrink:0;"
									>
										<circle
											cx="5"
											cy="5"
											r="4"
											stroke="currentColor"
											stroke-width="1.4"
											fill="none"
										/>
										<path
											d="M5 3v2.5l1.5 1"
											stroke="currentColor"
											stroke-width="1.2"
											stroke-linecap="round"
										/>
									</svg>
									Без аккаунта
								</span>
							{/if}
						</div>

						<!-- Кнопка изменить (только для локальных своих) -->
						{#if canManage}
							<button
								type="button"
								onclick={() => (isEditing ? closeEditForm() : openEditForm(p))}
								class="flex h-8 shrink-0 items-center justify-center rounded-lg px-2.5 text-xs font-semibold transition-colors"
								style="background: {isEditing
									? 'var(--color-green-tint)'
									: 'transparent'}; border: 1px solid {isEditing
									? 'var(--color-green-tint-border)'
									: 'var(--color-border)'}; color: {isEditing
									? 'var(--color-green-primary)'
									: 'var(--color-text-muted)'}; cursor: pointer;"
								aria-label="Изменить персону {p.name}"
							>
								Изменить
							</button>
						{/if}

						<!-- Кнопка удалить (только для локальных своих) -->
						{#if canManage}
							<form
								method="POST"
								action="?/deletePersona"
								use:enhance={() => {
									deletingId = p.id;
									deleteError = '';
									return async ({ result, update }) => {
										deletingId = null;
										if (result.type === 'failure') {
											deleteError = (result.data as { error?: string })?.error ?? 'Ошибка удаления';
										}
										await update();
									};
								}}
							>
								<input type="hidden" name="persona_id" value={p.id} />
								<button
									type="submit"
									disabled={deletingId === p.id}
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
									style="background: transparent; border: 1px solid var(--color-border); color: var(--color-text-muted); cursor: pointer;"
									onmouseenter={(e) => {
										(e.currentTarget as HTMLElement).style.background = 'var(--color-error-bg)';
										(e.currentTarget as HTMLElement).style.color = 'var(--color-error)';
										(e.currentTarget as HTMLElement).style.borderColor =
											'var(--color-error-border)';
									}}
									onmouseleave={(e) => {
										(e.currentTarget as HTMLElement).style.background = 'transparent';
										(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
										(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
									}}
									aria-label="Удалить персону {p.name}"
								>
									<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
										<path
											d="M2 3.5h10M5.5 3.5V2.5h3v1M5.5 6v4M8.5 6v4M3 3.5l.7 7.5h6.6l.7-7.5"
											stroke="currentColor"
											stroke-width="1.5"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								</button>
							</form>
						{/if}
					</div>

					<!-- Форма редактирования локальной персоны -->
					{#if isEditing}
						<form
							method="POST"
							action="?/updateLocalPersona"
							use:enhance={() => {
								editSaving = true;
								editError = '';
								return async ({ result, update }) => {
									editSaving = false;
									if (result.type === 'success') {
										closeEditForm();
										await update();
									} else if (result.type === 'failure') {
										const d = result.data as { updateError?: string } | undefined;
										editError = d?.updateError ?? 'Ошибка сохранения';
									}
								};
							}}
							class="flex flex-col gap-3"
							style="padding: 0 20px 16px; background: var(--color-bg-page);"
						>
							<input type="hidden" name="persona_id" value={p.id} />

							<!-- Имя -->
							<div>
								<label
									for="edit-name-{p.id}"
									class="mb-1.5 block text-xs font-semibold"
									style="color: var(--color-text-primary);">Имя</label
								>
								<input
									id="edit-name-{p.id}"
									name="name"
									type="text"
									bind:value={editName}
									placeholder="Например: Иван"
									required
									class="brand-input"
								/>
							</div>

							<!-- КБЖУ -->
							<div>
								<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-primary);">
									Цели КБЖУ (необязательно)
								</p>
								<div class="grid grid-cols-4 gap-2">
									<div>
										<label
											for="edit-kcal-{p.id}"
											class="mb-1 block text-xs"
											style="color: var(--color-text-muted);">Ккал</label
										>
										<input
											id="edit-kcal-{p.id}"
											name="kcal_target"
											type="number"
											bind:value={editKcal}
											min="500"
											max="9999"
											placeholder="2000"
											class="brand-input"
											style="padding: 8px;"
										/>
									</div>
									<div>
										<label
											for="edit-protein-{p.id}"
											class="mb-1 block text-xs"
											style="color: var(--color-text-muted);">Белки (г)</label
										>
										<input
											id="edit-protein-{p.id}"
											name="protein_target"
											type="number"
											bind:value={editProtein}
											min="0"
											max="999"
											placeholder="150"
											class="brand-input"
											style="padding: 8px;"
										/>
									</div>
									<div>
										<label
											for="edit-fat-{p.id}"
											class="mb-1 block text-xs"
											style="color: var(--color-text-muted);">Жиры (г)</label
										>
										<input
											id="edit-fat-{p.id}"
											name="fat_target"
											type="number"
											bind:value={editFat}
											min="0"
											max="999"
											placeholder="70"
											class="brand-input"
											style="padding: 8px;"
										/>
									</div>
									<div>
										<label
											for="edit-carbs-{p.id}"
											class="mb-1 block text-xs"
											style="color: var(--color-text-muted);">Углев. (г)</label
										>
										<input
											id="edit-carbs-{p.id}"
											name="carbs_target"
											type="number"
											bind:value={editCarbs}
											min="0"
											max="999"
											placeholder="250"
											class="brand-input"
											style="padding: 8px;"
										/>
									</div>
								</div>
							</div>

							{#if editError}
								<p
									class="rounded-lg px-3 py-2 text-sm"
									style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);"
								>
									{editError}
								</p>
							{/if}

							<div class="flex gap-2">
								<button
									type="submit"
									disabled={editSaving}
									class="btn-primary"
									style="width: auto; padding: 8px 20px;"
								>
									{editSaving ? 'Сохраняем...' : 'Сохранить'}
								</button>
								<button
									type="button"
									onclick={closeEditForm}
									class="btn-ghost"
									style="padding: 8px 16px;"
								>
									Отмена
								</button>
							</div>
						</form>
					{/if}
				</div>
			{/each}

			{#if deleteError}
				<p
					class="mx-5 mb-3 rounded-lg px-3 py-2 text-sm"
					style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);"
				>
					{deleteError}
				</p>
			{/if}

			<!-- Кнопка добавить персону -->
			<div style="border-top: 1px solid var(--color-border); padding: 12px 20px;">
				{#if createSuccess}
					<p
						class="mb-2 flex items-center gap-1.5 text-sm font-semibold"
						style="color: var(--color-success);"
					>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;"
							><path
								d="M2 7l3.5 3.5 6.5-6"
								stroke="currentColor"
								stroke-width="1.8"
								stroke-linecap="round"
								stroke-linejoin="round"
							/></svg
						>
						Персона создана
					</p>
				{/if}
				{#if !showCreateForm}
					<button
						type="button"
						onclick={() => {
							showCreateForm = true;
							newPersonaName = '';
							newPersonaNoAccount = false;
							createError = '';
						}}
						class="flex items-center gap-2 text-sm font-semibold transition-colors"
						style="background: none; border: none; padding: 0; cursor: pointer; color: var(--color-green-primary);"
					>
						<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
							<path
								d="M8 3v10M3 8h10"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
							/>
						</svg>
						Добавить персону
					</button>
				{:else}
					<form
						method="POST"
						action="?/createPersona"
						use:enhance={() => {
							creating = true;
							createError = '';
							return async ({ result, update }) => {
								creating = false;
								if (result.type === 'success') {
									createSuccess = true;
									showCreateForm = false;
									newPersonaName = '';
									newPersonaNoAccount = false;
									if (createSuccessTimer) clearTimeout(createSuccessTimer);
								createSuccessTimer = setTimeout(() => { createSuccess = false; createSuccessTimer = null; }, 2500);
								} else if (result.type === 'failure') {
									createError = (result.data as { createError?: string })?.createError ?? 'Ошибка';
								}
								await update();
							};
						}}
						class="flex flex-col gap-3"
					>
						<!-- Имя -->
						<div>
							<label
								for="new-persona-name"
								class="mb-1.5 block text-xs font-semibold"
								style="color: var(--color-text-primary);">Имя</label
							>
							<input
								id="new-persona-name"
								name="name"
								type="text"
								bind:value={newPersonaName}
								placeholder="Например: Иван"
								required
								class="brand-input"
							/>
						</div>

						<!-- Тумблер «Без аккаунта» -->
						<div
							style="border-radius: var(--radius-lg); border: 1px solid {newPersonaNoAccount
								? 'var(--color-green-tint-border)'
								: 'var(--color-border)'}; overflow: hidden; transition: border-color var(--transition-fast);"
						>
							<button
								type="button"
								onclick={() => (newPersonaNoAccount = !newPersonaNoAccount)}
								class="flex w-full items-center gap-3 px-4 py-3"
								style="background: {newPersonaNoAccount
									? 'var(--color-green-tint)'
									: 'var(--color-bg-page)'}; border: none; cursor: pointer; transition: background var(--transition-fast);"
							>
								<div
									class="relative h-6 w-10 shrink-0 rounded-full"
									style="background: {newPersonaNoAccount
										? 'var(--color-green-primary)'
										: 'var(--color-border)'}; transition: background var(--transition-fast);"
								>
									<span
										class="absolute top-1 block h-4 w-4 rounded-full shadow"
										style="background: var(--color-text-inverse); transform: translateX({newPersonaNoAccount
											? '20px'
											: '4px'}); transition: transform var(--transition-fast);"
									></span>
								</div>
								<div class="text-left">
									<p
										class="text-sm font-semibold"
										style="color: {newPersonaNoAccount
											? 'var(--color-green-primary)'
											: 'var(--color-text-primary)'};"
									>
										Без аккаунта
									</p>
								</div>
							</button>
							<div class="px-4 pt-1 pb-3">
								<p class="text-xs" style="color: var(--color-text-muted); line-height: 1.5;">
									{#if newPersonaNoAccount}
										Персона для члена семьи без аккаунта. Настройки КБЖУ можно задать после
										создания.
									{:else}
										Персона будет привязана к твоему аккаунту.
									{/if}
								</p>
							</div>
						</div>

						<!-- Скрытое поле флага -->
						<input type="hidden" name="no_account" value={newPersonaNoAccount ? '1' : '0'} />

						{#if createError}
							<p
								class="rounded-lg px-3 py-2 text-sm"
								style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);"
							>
								{createError}
							</p>
						{/if}

						<div class="flex gap-2">
							<button
								type="submit"
								disabled={creating}
								class="btn-primary"
								style="width: auto; padding: 8px 20px;"
							>
								{creating ? 'Создаём...' : 'Создать'}
							</button>
							<button
								type="button"
								onclick={() => {
									showCreateForm = false;
									createError = '';
								}}
								class="btn-ghost"
								style="padding: 8px 16px;"
							>
								Отмена
							</button>
						</div>
					</form>
				{/if}
			</div>
		</div>

		{#if persona}
			<div class="flex flex-col gap-4">
				<!-- ── РАЗДЕЛ: Профиль ──────────────────────────────── -->
				<div
					style="background: var(--color-bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); border: 1px solid var(--color-border); padding: 20px;"
				>
					<h2 class="mb-1 font-semibold" style="font-size: 16px; color: var(--color-text-primary);">
						Профиль
					</h2>
					<p class="mb-4 text-sm" style="color: var(--color-text-muted);">
						Личные данные для расчёта нормы
					</p>

					<div class="flex flex-col gap-4">
						<!-- Имя -->
						<div>
							<label
								for="name"
								class="mb-1.5 block text-xs font-semibold"
								style="color: var(--color-text-primary);">Имя</label
							>
							<input
								id="name"
								type="text"
								bind:value={name}
								placeholder="Катя"
								class="brand-input"
							/>
						</div>

						<!-- Пол -->
						<div>
							<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-primary);">
								Пол
							</p>
							<div class="flex gap-2">
								{#each [{ val: 'male', label: 'Мужской' }, { val: 'female', label: 'Женский' }] as g}
									<button
										onclick={() => (gender = g.val as Gender)}
										class="flex-1 py-2.5 text-sm font-semibold transition-all"
										style="
                    border-radius: var(--radius-md);
                    border: 1.5px solid {gender === g.val
											? 'var(--color-green-primary)'
											: 'var(--color-border)'};
                    background: {gender === g.val
											? 'var(--color-green-primary)'
											: 'var(--color-bg-card)'};
                    color: {gender === g.val ? 'var(--color-text-inverse)' : 'var(--color-text-muted)'};
                  ">{g.label}</button
									>
								{/each}
							</div>
						</div>

						<!-- Возраст / Вес / Рост -->
						<div class="grid grid-cols-3 gap-3">
							<div>
								<label
									for="age"
									class="mb-1.5 block text-xs font-semibold"
									style="color: var(--color-text-primary);">Возраст</label
								>
								<input
									id="age"
									type="number"
									bind:value={age}
									min="10"
									max="100"
									placeholder="30"
									class="brand-input"
									style="padding: 10px;"
								/>
							</div>
							<div>
								<label
									for="weight"
									class="mb-1.5 block text-xs font-semibold"
									style="color: var(--color-text-primary);">Вес (кг)</label
								>
								<input
									id="weight"
									type="number"
									bind:value={weight}
									min="30"
									max="300"
									placeholder="70"
									class="brand-input"
									style="padding: 10px;"
								/>
							</div>
							<div>
								<label
									for="height"
									class="mb-1.5 block text-xs font-semibold"
									style="color: var(--color-text-primary);">Рост (см)</label
								>
								<input
									id="height"
									type="number"
									bind:value={height}
									min="100"
									max="250"
									placeholder="175"
									class="brand-input"
									style="padding: 10px;"
								/>
							</div>
						</div>

						<!-- Активность -->
						<div>
							<label
								for="activity"
								class="mb-1.5 block text-xs font-semibold"
								style="color: var(--color-text-primary);">Уровень активности</label
							>
							<select id="activity" bind:value={activity} class="brand-input">
								{#each Object.entries(ACTIVITY_LABELS) as [val, label]}
									<option value={val}>{label}</option>
								{/each}
							</select>
						</div>

						<!-- Формула расчёта -->
						<div>
							<label
								for="formula"
								class="mb-1.5 block text-xs font-semibold"
								style="color: var(--color-text-primary);">Формула расчёта калорий</label
							>
							<select id="formula" bind:value={formula} class="brand-input">
								<option value="mifflin">Миффлин — Сан Жеор (рекомендуется)</option>
								<option value="harris">Харрис — Бенедикт</option>
							</select>
						</div>
					</div>
				</div>

				<!-- ── РАЗДЕЛ: Генерация меню ───────────────────────── -->
				<div
					style="background: var(--color-bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); border: 1px solid var(--color-border); padding: 20px;"
				>
					<h2 class="mb-1 font-semibold" style="font-size: 16px; color: var(--color-text-primary);">
						Генерация меню
					</h2>
					<p class="mb-4 text-sm" style="color: var(--color-text-muted);">
						Как подбирать блюда при автоматическом составлении плана
					</p>

					<!-- Тумблер match_kcal -->
					<div
						class="mb-4"
						style="border-radius: var(--radius-lg); border: 1px solid {matchKcal
							? 'var(--color-green-tint-border)'
							: 'var(--color-border)'}; overflow: hidden; transition: border-color var(--transition-fast);"
					>
						<button
							type="button"
							onclick={() => (matchKcal = !matchKcal)}
							class="flex w-full items-center gap-3 px-4 py-3"
							style="background: {matchKcal
								? 'var(--color-green-tint)'
								: 'var(--color-bg-page)'}; border: none; cursor: pointer; transition: background var(--transition-fast);"
						>
							<div
								class="relative h-6 w-10 shrink-0 rounded-full"
								style="background: {matchKcal
									? 'var(--color-green-primary)'
									: 'var(--color-border)'}; transition: background var(--transition-fast);"
							>
								<span
									class="absolute top-1 block h-4 w-4 rounded-full shadow"
									style="background: var(--color-text-inverse); transform: translateX({matchKcal
										? '20px'
										: '4px'}); transition: transform var(--transition-fast);"
								></span>
							</div>
							<span
								class="text-left text-sm font-semibold"
								style="color: {matchKcal
									? 'var(--color-green-primary)'
									: 'var(--color-text-primary)'};"
							>
								Считаю калории и слежу за КБЖУ
							</span>
						</button>
						<div class="px-4 pt-1 pb-3">
							<p class="text-xs" style="color: var(--color-text-muted); line-height: 1.5;">
								{#if matchKcal}
									Блюда подбираются ближайшие к твоей норме калорий.
								{:else}
									Блюда выбираются случайно — удобно, если считать ккал не хочется.
								{/if}
							</p>
						</div>
					</div>

					<!-- Блок расчёта КБЖУ — только при matchKcal -->
					{#if matchKcal}
						{#if kbju}
							<div
								class="mb-4"
								style="background: var(--color-green-tint); border-radius: var(--radius-lg); padding: 16px; border: 1px solid var(--color-green-tint-border);"
							>
								<p
									class="mb-3 text-xs font-semibold uppercase"
									style="color: var(--color-green-primary);"
								>
									Твоя суточная норма
								</p>
								<div class="mb-3 grid grid-cols-4 gap-2 text-center">
									<div>
										<p class="text-lg font-bold" style="color: var(--color-green-primary);">
											{kbju.kcal}
										</p>
										<p class="text-xs" style="color: var(--color-text-muted);">ккал</p>
									</div>
									<div>
										<p class="text-lg font-bold" style="color: var(--color-macro-protein);">
											{kbju.protein}
										</p>
										<p class="text-xs" style="color: var(--color-text-muted);">белки г</p>
									</div>
									<div>
										<p class="text-lg font-bold" style="color: var(--color-macro-fat);">
											{kbju.fat}
										</p>
										<p class="text-xs" style="color: var(--color-text-muted);">жиры г</p>
									</div>
									<div>
										<p class="text-lg font-bold" style="color: var(--color-macro-carbs);">
											{kbju.carbs}
										</p>
										<p class="text-xs" style="color: var(--color-text-muted);">углев. г</p>
									</div>
								</div>
								<div
									style="border-top: 1px solid var(--color-green-tint-border); padding-top: 12px;"
								>
									<p class="mb-2 text-xs" style="color: var(--color-text-muted);">
										Скорректировать калории вручную:
									</p>
									<div class="flex gap-2">
										<input
											type="number"
											value={kcalOverride !== '' ? kcalOverride : ''}
											oninput={handleKcalOverride}
											placeholder={String(kbju.kcal)}
											min="800"
											max="6000"
											class="brand-input"
											style="padding: 8px 12px; font-size: 14px;"
										/>
										{#if kcalOverride !== ''}
											<button onclick={() => (kcalOverride = '')} class="btn-ghost">Сброс</button>
										{/if}
									</div>
								</div>
							</div>
						{:else}
							<div
								class="mb-4 py-4 text-center"
								style="background: var(--color-bg-page); border-radius: var(--radius-lg); border: 1px solid var(--color-border);"
							>
								<p class="text-sm" style="color: var(--color-text-muted);">
									Заполни возраст, вес и рост выше — рассчитаем норму автоматически
								</p>
							</div>
						{/if}

						<!-- Распределение по приёмам -->
						<div>
							<p class="mb-3 text-xs font-semibold" style="color: var(--color-text-primary);">
								Распределение калорий по приёмам пищи
							</p>
							<div class="grid grid-cols-3 gap-3">
								{#each [{ id: 'bf', label: 'Завтрак', bind: bf }, { id: 'ln', label: 'Обед', bind: ln }, { id: 'dn', label: 'Ужин', bind: dn }] as item}
									<div>
										<label
											for={item.id}
											class="mb-1.5 block text-center text-xs"
											style="color: var(--color-text-muted);">{item.label}</label
										>
										<div class="relative">
											{#if item.id === 'bf'}
												<input
													id="bf"
													type="number"
													bind:value={bf}
													min="0"
													max="100"
													class="brand-input {!ratioValid ? 'error' : ''}"
													style="padding: 10px 24px 10px 10px; text-align: center;"
												/>
											{:else if item.id === 'ln'}
												<input
													id="ln"
													type="number"
													bind:value={ln}
													min="0"
													max="100"
													class="brand-input {!ratioValid ? 'error' : ''}"
													style="padding: 10px 24px 10px 10px; text-align: center;"
												/>
											{:else}
												<input
													id="dn"
													type="number"
													bind:value={dn}
													min="0"
													max="100"
													class="brand-input {!ratioValid ? 'error' : ''}"
													style="padding: 10px 24px 10px 10px; text-align: center;"
												/>
											{/if}
											<span
												class="absolute top-1/2 right-2 -translate-y-1/2 text-sm"
												style="color: var(--color-text-muted);">%</span
											>
										</div>
									</div>
								{/each}
							</div>
							<p
								class="mt-2 flex items-center justify-center gap-1 text-center text-xs"
								style="color: {ratioValid ? 'var(--color-success)' : 'var(--color-error)'};"
							>
								{#if ratioValid}<svg
										width="12"
										height="12"
										viewBox="0 0 12 12"
										fill="none"
										style="flex-shrink:0;"
										><path
											d="M2 6l3 3 5-5"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linecap="round"
											stroke-linejoin="round"
										/></svg
									>{/if}
								Сумма: {ratioSum}%{ratioValid ? '' : ' — должно быть 100%'}
							</p>
						</div>
					{/if}

					<!-- Разделитель -->
					<div style="height: 1px; background: var(--color-border); margin: 20px 0;"></div>

					<!-- Тумблер carry_dinner_to_lunch -->
					<div class="flex items-start gap-3">
						<button
							type="button"
							role="switch"
							aria-checked={carryDinner}
							aria-label="Переносить ужин на обед следующего дня"
							onclick={() => (carryDinner = !carryDinner)}
							class="relative mt-0.5 h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors"
							style="background: {carryDinner
								? 'var(--color-green-primary)'
								: 'var(--color-border)'}; border: none; padding: 0;"
						>
							<span
								class="absolute top-1 block h-4 w-4 rounded-full shadow transition-transform"
								style="background: var(--color-text-inverse); transform: translateX({carryDinner
									? '20px'
									: '4px'});"
							></span>
						</button>
						<div>
							<p class="text-sm font-semibold" style="color: var(--color-text-primary);">
								Переносить ужин на обед следующего дня
							</p>
							<p class="mt-0.5 text-xs" style="color: var(--color-text-muted); line-height: 1.5;">
								Готовишь несколько порций сразу — одна идёт на ужин, другая на завтра в обед. При
								генерации меню обед каждого дня будет совпадать с ужином предыдущего.
							</p>
						</div>
					</div>
				</div>

				<!-- Ошибка -->
				{#if errorMsg}
					<p
						class="rounded-lg px-3 py-2 text-sm"
						style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);"
					>
						{errorMsg}
					</p>
				{/if}

				<!-- Кнопка сохранить -->
				<div class="flex items-center gap-3">
					<button
						onclick={save}
						disabled={saving}
						class="btn-primary"
						style="width: auto; padding: 10px 24px;"
					>
						{saving ? 'Сохраняем...' : 'Сохранить'}
					</button>
					{#if saved}
						<p
							class="flex items-center gap-1.5 text-sm font-semibold"
							style="color: var(--color-success);"
						>
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;"
								><path
									d="M2 7l3.5 3.5 6.5-6"
									stroke="currentColor"
									stroke-width="1.8"
									stroke-linecap="round"
									stroke-linejoin="round"
								/></svg
							>
							Сохранено
						</p>
					{/if}
				</div>

				<!-- ── РАЗДЕЛ: Безопасность ────────────────────────────── -->
				<div
					style="background: var(--color-bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); border: 1px solid var(--color-border); padding: 20px;"
				>
					<h2 class="mb-1 font-semibold" style="font-size: 16px; color: var(--color-text-primary);">
						Безопасность
					</h2>
					<p class="mb-4 text-sm" style="color: var(--color-text-muted);">
						Смена пароля от аккаунта
					</p>

					<form
						method="POST"
						action="?/changePassword"
						use:enhance={() => {
							pwSaving = true;
							pwError = '';
							pwSuccess = false;
							return async ({ result, update }) => {
								pwSaving = false;
								if (result.type === 'success') {
									pwSuccess = true;
									pwNew = '';
									pwConfirm = '';
									if (pwSuccessTimer) clearTimeout(pwSuccessTimer);
								pwSuccessTimer = setTimeout(() => { pwSuccess = false; pwSuccessTimer = null; }, 3000);
								} else if (result.type === 'failure') {
									pwError = (result.data as { error?: string })?.error ?? 'Ошибка';
								}
								await update({ reset: false });
							};
						}}
						class="flex flex-col gap-4"
					>
						<div>
							<label
								for="pw-new"
								class="mb-1.5 block text-xs font-semibold"
								style="color: var(--color-text-primary);">Новый пароль</label
							>
							<input
								id="pw-new"
								name="password"
								type="password"
								bind:value={pwNew}
								placeholder="Не менее 6 символов"
								minlength="6"
								required
								class="brand-input {pwError ? 'error' : ''}"
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
								name="confirm"
								type="password"
								bind:value={pwConfirm}
								placeholder="Повтори новый пароль"
								minlength="6"
								required
								class="brand-input {pwError ? 'error' : ''}"
							/>
						</div>

						{#if pwError}
							<p
								class="rounded-lg px-3 py-2 text-sm"
								style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);"
							>
								{pwError}
							</p>
						{/if}

						<div class="flex items-center gap-3">
							<button
								type="submit"
								disabled={pwSaving}
								class="btn-primary"
								style="width: auto; padding: 10px 24px;"
							>
								{pwSaving ? 'Сохраняем...' : 'Сменить пароль'}
							</button>
							{#if pwSuccess}
								<p
									class="flex items-center gap-1.5 text-sm font-semibold"
									style="color: var(--color-success);"
								>
									<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;"
										><path
											d="M2 7l3.5 3.5 6.5-6"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linecap="round"
											stroke-linejoin="round"
										/></svg
									>
									Пароль обновлён
								</p>
							{/if}
						</div>
					</form>
				</div>
			</div>
		{:else}
			<p style="color: var(--color-text-muted);">Нет активной персоны</p>
		{/if}
	</div>

	<!-- ── Моя семья ──────────────────────────────────────────── -->
	<div class="mx-auto w-full max-w-2xl px-4 pb-8">
		<div
			class="rounded-xl p-6"
			style="background: var(--color-bg-card); border: 1px solid var(--color-border);"
		>
			<h2 class="mb-4 font-semibold" style="font-size: 16px; color: var(--color-text-primary);">
				Моя семья
			</h2>

			{#if familyError}
				<p
					class="mb-4 rounded-lg px-3 py-2 text-sm"
					style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);"
				>
					{familyError}
				</p>
			{/if}

			{#if isOwner}
				<!-- Владелец: список участников -->
				<div class="mb-5">
					<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-muted);">
						УЧАСТНИКИ
					</p>
					<div class="flex flex-col gap-2">
						{#each members as member (member.id)}
							{@const isSelf = member.user_id === page.data.user?.id}
							<div
								class="flex items-center justify-between rounded-lg px-3 py-2"
								style="background: var(--color-bg-page); border: 1px solid var(--color-border);"
							>
								<span class="text-sm" style="color: var(--color-text-primary);">
									{#if isSelf}
										{page.data.user?.email}
										<span style="color: var(--color-text-muted);">(Вы, владелец)</span>
									{:else}
										Участник …{member.user_id.slice(-6)}
									{/if}
								</span>
								{#if !isSelf}
									<form
										method="POST"
										action="?/removeMember"
										use:enhance={({}) => {
											return async ({ result, update }) => {
												await update();
												if (result.type === 'failure') {
													familyError = String(
														(result.data as Record<string, unknown>)?.familyError ?? 'Ошибка'
													);
												}
											};
										}}
									>
										<input type="hidden" name="target_user_id" value={member.user_id} />
										<button
											type="submit"
											class="text-xs font-semibold"
											style="color: var(--color-error); background: none; border: none; cursor: pointer; padding: 4px 8px;"
										>
											Удалить
										</button>
									</form>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<!-- Инвайт-код -->
				<div class="mb-5">
					<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-muted);">
						КОД ПРИГЛАШЕНИЯ
					</p>
					<div
						class="mb-3 flex items-center gap-3 rounded-lg px-4 py-3"
						style="background: var(--color-bg-page); border: 1px solid var(--color-border);"
					>
						<span
							class="flex-1 font-mono text-lg font-bold tracking-widest"
							style="color: var(--color-text-primary);"
						>
							{inviteCodeState}
						</span>
					</div>
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							onclick={copyCode}
							class="btn-secondary text-sm"
							style="width: auto; padding: 8px 16px;"
						>
							{copyCodeSuccess ? '✓ Скопировано' : 'Скопировать код'}
						</button>
						<button
							type="button"
							onclick={copyLink}
							class="btn-secondary text-sm"
							style="width: auto; padding: 8px 16px;"
						>
							{copyLinkSuccess ? '✓ Скопировано' : 'Поделиться ссылкой'}
						</button>
						<form
							method="POST"
							action="?/refreshInviteCode"
							use:enhance={({}) => {
								return async ({ result, update }) => {
									await update();
									if (
										result.type === 'success' &&
										(result.data as Record<string, unknown>)?.newInviteCode
									) {
										inviteCodeState = String(
											(result.data as Record<string, unknown>).newInviteCode
										);
									}
									if (result.type === 'failure') {
										familyError = String(
											(result.data as Record<string, unknown>)?.familyError ?? 'Ошибка'
										);
									}
								};
							}}
						>
							<button
								type="submit"
								class="btn-secondary text-sm"
								style="width: auto; padding: 8px 16px;"
							>
								Обновить код
							</button>
						</form>
					</div>
				</div>

				<!-- Заявки на вступление -->
				{#if pendingRequests.length > 0}
					<div>
						<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-muted);">
							ЗАЯВКИ НА ВСТУПЛЕНИЕ
							<span
								class="ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold"
								style="background: var(--color-accent); color: var(--color-bg-card); min-width: 18px;"
							>
								{pendingRequests.length}
							</span>
						</p>
						<div class="flex flex-col gap-2">
							{#each pendingRequests as req (req.id)}
								<div
									class="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
									style="background: var(--color-bg-page); border: 1px solid var(--color-border);"
								>
									<div>
										<p class="text-sm font-medium" style="color: var(--color-text-primary);">
											{req.requester_name}
										</p>
										<p class="text-xs" style="color: var(--color-text-muted);">
											{new Date(req.created_at).toLocaleDateString('ru-RU')}
										</p>
									</div>
									<div class="flex gap-2">
										<form
											method="POST"
											action="?/approveRequest"
											use:enhance={({}) => {
												return async ({ result, update }) => {
													await update();
													if (result.type === 'failure') {
														familyError = String(
															(result.data as Record<string, unknown>)?.familyError ?? 'Ошибка'
														);
													}
												};
											}}
										>
											<input type="hidden" name="request_id" value={req.id} />
											<button
												type="submit"
												class="btn-primary text-xs"
												style="width: auto; padding: 6px 14px;"
											>
												Принять
											</button>
										</form>
										<form
											method="POST"
											action="?/rejectRequest"
											use:enhance={({}) => {
												return async ({ result, update }) => {
													await update();
													if (result.type === 'failure') {
														familyError = String(
															(result.data as Record<string, unknown>)?.familyError ?? 'Ошибка'
														);
													}
												};
											}}
										>
											<input type="hidden" name="request_id" value={req.id} />
											<button
												type="submit"
												class="btn-secondary text-xs"
												style="width: auto; padding: 6px 14px;"
											>
												Отклонить
											</button>
										</form>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{:else}
				<!-- Участник: кнопка выхода -->
				<p class="mb-4 text-sm" style="color: var(--color-text-muted);">
					Вы участник семьи другого пользователя
				</p>
				<form
					method="POST"
					action="?/leaveFamily"
					use:enhance={({}) => {
						return async ({ result, update }) => {
							await update();
							if (result.type === 'failure') {
								familyError = String(
									(result.data as Record<string, unknown>)?.familyError ?? 'Ошибка'
								);
							}
						};
					}}
				>
					<button
						type="submit"
						class="btn-secondary text-sm"
						style="width: auto; padding: 8px 16px; color: var(--color-error);"
					>
						Выйти из семьи
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>
