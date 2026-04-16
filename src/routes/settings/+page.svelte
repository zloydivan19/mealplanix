<script lang="ts">
	import { page } from '$app/state';
import { enhance } from '$app/forms';
	import { calcKbju, ACTIVITY_LABELS } from '$lib/utils/kbju.js';
	import type {
		Persona,
		Household,
		ActivityLevel,
		Formula,
		Gender,
		HouseholdMember,
		HouseholdJoinRequest
	} from '$lib/types/database.js';

	let persona = $derived(page.data.persona as Persona | null);
	let personas = $derived(page.data.personas as Persona[]);
	let currentUserId = $derived(page.data.user?.id as string | undefined);

	// ── Создание персоны ──────────────────────────────────────
	let showCreateForm = $state(false);
	let newPersonaName = $state('');
	// Персоны из настроек всегда локальные (user_id = null)
	// Основная персона создаётся только на онбординге
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
	let editGender = $state<Gender>('male');
	let editAge = $state<number | ''>('');
	let editWeight = $state<number | ''>('');
	let editHeight = $state<number | ''>('');
	let editActivity = $state<ActivityLevel>('moderate');
	let editFormula = $state<Formula>('mifflin');
	let editMatchKcal = $state(false);
	let editBf = $state(25);
	let editLn = $state(40);
	let editDn = $state(35);
	let editKcalOverride = $state<number | ''>('');

	function openEditForm(p: Persona) {
		editingLocalPersonaId = p.id;
		editName = p.name;
		editGender = p.gender ?? 'male';
		editAge = p.age ?? '';
		editWeight = p.weight ?? '';
		editHeight = p.height ?? '';
		editActivity = p.activity ?? 'moderate';
		editFormula = p.formula ?? 'mifflin';
		editMatchKcal = p.match_kcal ?? false;
		const r = p.meal_ratios as { bf: number; ln: number; dn: number } | null;
		editBf = r?.bf ?? 25;
		editLn = r?.ln ?? 40;
		editDn = r?.dn ?? 35;
		editKcal = p.kcal_target ?? '';
		editProtein = p.protein_target ?? '';
		editFat = p.fat_target ?? '';
		editCarbs = p.carbs_target ?? '';
		editKcalOverride = '';
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

	// ── Настройки генерации (уровень домохозяйства) ──────────
	let carryDinner = $state((page.data.household as Household | null)?.carry_dinner_to_lunch ?? true);

	let editKbju = $derived.by(() => {
		if (!editMatchKcal) return null;
		if (!editAge || !editWeight || !editHeight) return null;
		return calcKbju(
			editGender,
			Number(editAge),
			Number(editWeight),
			Number(editHeight),
			editActivity,
			editFormula,
			editKcalOverride !== '' ? Number(editKcalOverride) : null
		);
	});

	let editRatioSum = $derived(editBf + editLn + editDn);
	let editRatioValid = $derived(editRatioSum === 100);


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
				{@const isMainPersona = p.user_id === currentUserId}
				{@const canEdit = canManage || isMainPersona}
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

						<!-- Кнопка изменить (для своих персон и основной персоны) -->
						{#if canEdit}
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

					<!-- Форма редактирования персоны -->
					{#if isEditing}
						<form
							method="POST"
							action={isLocal ? '?/updateLocalPersona' : '?/updateMainPersona'}
							use:enhance={({ cancel }) => {
								if (editMatchKcal && !editKbju) {
									editError = 'Заполни возраст, вес и рост';
									cancel();
									return;
								}
								if (editMatchKcal && !editRatioValid) {
									editError = 'Сумма % по приёмам пищи должна быть 100';
									cancel();
									return;
								}
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
							class="flex flex-col gap-4"
							style="padding: 0 20px 16px; background: var(--color-bg-page);"
						>
							<!-- Скрытые поля -->
							<input type="hidden" name="persona_id" value={p.id} />
							<input type="hidden" name="gender" value={editGender} />
							<input type="hidden" name="age" value={editAge} />
							<input type="hidden" name="weight" value={editWeight} />
							<input type="hidden" name="height" value={editHeight} />
							<input type="hidden" name="activity" value={editActivity} />
							<input type="hidden" name="formula" value={editFormula} />
							<input type="hidden" name="match_kcal" value={editMatchKcal ? '1' : '0'} />
								<input type="hidden" name="bf" value={editBf} />
							<input type="hidden" name="ln" value={editLn} />
							<input type="hidden" name="dn" value={editDn} />
							<input type="hidden" name="kcal_target" value={editMatchKcal ? (editKbju?.kcal ?? '') : editKcal} />
							<input type="hidden" name="protein_target" value={editMatchKcal ? (editKbju?.protein ?? '') : editProtein} />
							<input type="hidden" name="fat_target" value={editMatchKcal ? (editKbju?.fat ?? '') : editFat} />
							<input type="hidden" name="carbs_target" value={editMatchKcal ? (editKbju?.carbs ?? '') : editCarbs} />

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

							<!-- Пол -->
							<div>
								<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-primary);">
									Пол
								</p>
								<div class="flex gap-2">
									{#each [{ val: 'male', label: 'Мужской' }, { val: 'female', label: 'Женский' }] as g}
										<button
											type="button"
											onclick={() => (editGender = g.val as Gender)}
											class="flex-1 py-2.5 text-sm font-semibold transition-all"
											style="
												border-radius: var(--radius-md);
												border: 1.5px solid {editGender === g.val ? 'var(--color-green-primary)' : 'var(--color-border)'};
												background: {editGender === g.val ? 'var(--color-green-primary)' : 'var(--color-bg-card)'};
												color: {editGender === g.val ? 'var(--color-text-inverse)' : 'var(--color-text-muted)'};
											">{g.label}</button
										>
									{/each}
								</div>
							</div>

							<!-- Возраст / Вес / Рост -->
							<div class="grid grid-cols-3 gap-3">
								<div>
									<label
										for="edit-age-{p.id}"
										class="mb-1.5 block text-xs font-semibold"
										style="color: var(--color-text-primary);">Возраст</label
									>
									<input
										id="edit-age-{p.id}"
										type="number"
										bind:value={editAge}
										min="10"
										max="100"
										placeholder="30"
										class="brand-input"
										style="padding: 10px;"
									/>
								</div>
								<div>
									<label
										for="edit-weight-{p.id}"
										class="mb-1.5 block text-xs font-semibold"
										style="color: var(--color-text-primary);">Вес (кг)</label
									>
									<input
										id="edit-weight-{p.id}"
										type="number"
										bind:value={editWeight}
										min="30"
										max="300"
										placeholder="70"
										class="brand-input"
										style="padding: 10px;"
									/>
								</div>
								<div>
									<label
										for="edit-height-{p.id}"
										class="mb-1.5 block text-xs font-semibold"
										style="color: var(--color-text-primary);">Рост (см)</label
									>
									<input
										id="edit-height-{p.id}"
										type="number"
										bind:value={editHeight}
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
									for="edit-activity-{p.id}"
									class="mb-1.5 block text-xs font-semibold"
									style="color: var(--color-text-primary);">Уровень активности</label
								>
								<select id="edit-activity-{p.id}" bind:value={editActivity} class="brand-input">
									{#each Object.entries(ACTIVITY_LABELS) as [val, label]}
										<option value={val}>{label}</option>
									{/each}
								</select>
							</div>

							<!-- Формула расчёта -->
							<div>
								<label
									for="edit-formula-{p.id}"
									class="mb-1.5 block text-xs font-semibold"
									style="color: var(--color-text-primary);">Формула расчёта калорий</label
								>
								<select id="edit-formula-{p.id}" bind:value={editFormula} class="brand-input">
									<option value="mifflin">Миффлин — Сан Жеор (рекомендуется)</option>
									<option value="harris">Харрис — Бенедикт</option>
								</select>
							</div>

							<!-- Тумблер match_kcal -->
							<div
								style="border-radius: var(--radius-lg); border: 1px solid {editMatchKcal ? 'var(--color-green-tint-border)' : 'var(--color-border)'}; overflow: hidden; transition: border-color var(--transition-fast);"
							>
								<button
									type="button"
									onclick={() => (editMatchKcal = !editMatchKcal)}
									class="flex w-full items-center gap-3 px-4 py-3"
									style="background: {editMatchKcal ? 'var(--color-green-tint)' : 'var(--color-bg-page)'}; border: none; cursor: pointer; transition: background var(--transition-fast);"
								>
									<div
										class="relative h-6 w-10 shrink-0 rounded-full"
										style="background: {editMatchKcal ? 'var(--color-green-primary)' : 'var(--color-border)'}; transition: background var(--transition-fast);"
									>
										<span
											class="absolute top-1 block h-4 w-4 rounded-full shadow"
											style="background: var(--color-text-inverse); transform: translateX({editMatchKcal ? '20px' : '4px'}); transition: transform var(--transition-fast);"
										></span>
									</div>
									<span
										class="text-left text-sm font-semibold"
										style="color: {editMatchKcal ? 'var(--color-green-primary)' : 'var(--color-text-primary)'};"
									>
										Считаю калории и слежу за КБЖУ
									</span>
								</button>
								<div class="px-4 pt-1 pb-3">
									<p class="text-xs" style="color: var(--color-text-muted); line-height: 1.5;">
										{#if editMatchKcal}
											Блюда подбираются ближайшие к норме калорий.
										{:else}
											Блюда выбираются случайно — удобно, если считать ккал не хочется.
										{/if}
									</p>
								</div>
							</div>

							<!-- Блок расчёта КБЖУ — только при editMatchKcal -->
							{#if editMatchKcal}
								{#if editKbju}
									<div
										style="background: var(--color-green-tint); border-radius: var(--radius-lg); padding: 16px; border: 1px solid var(--color-green-tint-border);"
									>
										<p
											class="mb-3 text-xs font-semibold uppercase"
											style="color: var(--color-green-primary);"
										>
											Суточная норма
										</p>
										<div class="mb-3 grid grid-cols-4 gap-2 text-center">
											<div>
												<p class="text-lg font-bold" style="color: var(--color-green-primary);">{editKbju.kcal}</p>
												<p class="text-xs" style="color: var(--color-text-muted);">ккал</p>
											</div>
											<div>
												<p class="text-lg font-bold" style="color: var(--color-macro-protein);">{editKbju.protein}</p>
												<p class="text-xs" style="color: var(--color-text-muted);">белки г</p>
											</div>
											<div>
												<p class="text-lg font-bold" style="color: var(--color-macro-fat);">{editKbju.fat}</p>
												<p class="text-xs" style="color: var(--color-text-muted);">жиры г</p>
											</div>
											<div>
												<p class="text-lg font-bold" style="color: var(--color-macro-carbs);">{editKbju.carbs}</p>
												<p class="text-xs" style="color: var(--color-text-muted);">углев. г</p>
											</div>
										</div>
										<div style="border-top: 1px solid var(--color-green-tint-border); padding-top: 12px;">
											<p class="mb-2 text-xs" style="color: var(--color-text-muted);">
												Скорректировать калории вручную:
											</p>
											<div class="flex gap-2">
												<input
													type="number"
													value={editKcalOverride !== '' ? editKcalOverride : ''}
													oninput={(e) => {
														const v = (e.target as HTMLInputElement).valueAsNumber;
														editKcalOverride = isNaN(v) ? '' : v;
													}}
													placeholder={String(editKbju.kcal)}
													min="800"
													max="6000"
													class="brand-input"
													style="padding: 8px 12px; font-size: 14px;"
												/>
												{#if editKcalOverride !== ''}
													<button type="button" onclick={() => (editKcalOverride = '')} class="btn-ghost">Сброс</button>
												{/if}
											</div>
										</div>
									</div>
								{:else}
									<div
										class="py-4 text-center"
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
										<div>
											<label
												for="edit-bf-{p.id}"
												class="mb-1.5 block text-center text-xs"
												style="color: var(--color-text-muted);">Завтрак</label
											>
											<div class="relative">
												<input
													id="edit-bf-{p.id}"
													type="number"
													bind:value={editBf}
													min="0"
													max="100"
													class="brand-input {!editRatioValid ? 'error' : ''}"
													style="padding: 10px 24px 10px 10px; text-align: center;"
												/>
												<span class="absolute top-1/2 right-2 -translate-y-1/2 text-sm" style="color: var(--color-text-muted);">%</span>
											</div>
										</div>
										<div>
											<label
												for="edit-ln-{p.id}"
												class="mb-1.5 block text-center text-xs"
												style="color: var(--color-text-muted);">Обед</label
											>
											<div class="relative">
												<input
													id="edit-ln-{p.id}"
													type="number"
													bind:value={editLn}
													min="0"
													max="100"
													class="brand-input {!editRatioValid ? 'error' : ''}"
													style="padding: 10px 24px 10px 10px; text-align: center;"
												/>
												<span class="absolute top-1/2 right-2 -translate-y-1/2 text-sm" style="color: var(--color-text-muted);">%</span>
											</div>
										</div>
										<div>
											<label
												for="edit-dn-{p.id}"
												class="mb-1.5 block text-center text-xs"
												style="color: var(--color-text-muted);">Ужин</label
											>
											<div class="relative">
												<input
													id="edit-dn-{p.id}"
													type="number"
													bind:value={editDn}
													min="0"
													max="100"
													class="brand-input {!editRatioValid ? 'error' : ''}"
													style="padding: 10px 24px 10px 10px; text-align: center;"
												/>
												<span class="absolute top-1/2 right-2 -translate-y-1/2 text-sm" style="color: var(--color-text-muted);">%</span>
											</div>
										</div>
									</div>
									<p
										class="mt-2 flex items-center justify-center gap-1 text-center text-xs"
										style="color: {editRatioValid ? 'var(--color-success)' : 'var(--color-error)'};"
									>
										{#if editRatioValid}<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>{/if}
										Сумма: {editRatioSum}%{editRatioValid ? '' : ' — должно быть 100%'}
									</p>
								</div>
							{:else}
								<!-- Ручной ввод КБЖУ при match_kcal = false -->
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
							{/if}

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

						<p class="text-xs" style="color: var(--color-text-muted);">
							Персона для члена семьи без аккаунта. КБЖУ можно задать после создания.
						</p>

						<input type="hidden" name="no_account" value="1" />

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

		<!-- ── РАЗДЕЛ: Генерация меню ──────────────────────────── -->
		<div
			class="mb-4"
			style="background: var(--color-bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); border: 1px solid var(--color-border); padding: 20px;"
		>
			<h2 class="mb-1 font-semibold" style="font-size: 16px; color: var(--color-text-primary);">
				Генерация меню
			</h2>
			<p class="mb-4 text-sm" style="color: var(--color-text-muted);">Настройки применяются для всей семьи</p>

			<form
				method="POST"
				action="?/updateCarryDinner"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							await update();
						}
					};
				}}
				class="flex items-start gap-3"
			>
				<input type="hidden" name="carry_dinner_to_lunch" value={carryDinner ? '1' : '0'} />
				<button
					type="submit"
					role="switch"
					aria-checked={carryDinner}
					aria-label="Переносить ужин на обед следующего дня"
					onclick={(e) => { e.preventDefault(); carryDinner = !carryDinner; (e.currentTarget.closest('form') as HTMLFormElement).requestSubmit(); }}
					class="relative mt-0.5 h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors"
					style="background: {carryDinner ? 'var(--color-green-primary)' : 'var(--color-border)'}; border: none; padding: 0;"
				>
					<span
						class="absolute top-1 block h-4 w-4 rounded-full shadow transition-transform"
						style="background: var(--color-text-inverse); transform: translateX({carryDinner ? '20px' : '4px'});"
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
			</form>
		</div>

		<!-- ── РАЗДЕЛ: Безопасность ────────────────────────────── -->
		<div
			class="mb-4"
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
