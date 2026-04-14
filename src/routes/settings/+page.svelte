<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { calcKbju, ACTIVITY_LABELS } from '$lib/utils/kbju.js';
	import type { Persona, ActivityLevel, Formula, Gender } from '$lib/types/database.js';

	let persona = $derived(page.data.persona as Persona | null);
	let saving = $state(false);
	let saved = $state(false);
	let errorMsg = $state('');

	// ── Безопасность ─────────────────────────────────────────
	let pwNew = $state('');
	let pwConfirm = $state('');
	let pwSaving = $state(false);
	let pwSuccess = $state(false);
	let pwError = $state('');

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
		setTimeout(() => (saved = false), 2500);
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
                    color: {gender === g.val ? '#fff' : 'var(--color-text-muted)'};
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
									setTimeout(() => {
										pwSuccess = false;
									}, 3000);
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
</div>
