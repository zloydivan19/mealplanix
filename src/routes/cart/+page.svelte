<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { getWeekDays, getWeekLabel, getWeekId } from '$lib/utils/week.js';
	import { aggregateIngredients, type CartItem } from '$lib/utils/ingredients.js';
	import { SHOPPING_CATEGORY_LABELS, SHOPPING_CATEGORY_ORDER } from '$lib/types/dish.js';
	import type { ShoppingCategory } from '$lib/types/dish.js';
	import type { Dish, CustomDish, FridgeRow, CartState } from '$lib/types/database.js';
	import type { PageData } from './$types.js';

	// Subset selected from cart_state
	type CartStateRow = Pick<
		CartState,
		'ingredient_name' | 'price' | 'is_checked' | 'source' | 'qty' | 'unit' | 'category'
	>;

	let { data } = $props<{ data: PageData }>();

	// ── Навигация по неделям ──────────────────────────────────────────────
	let weekOffset = $state(browser ? Number(localStorage.getItem('pm_cart_week') ?? 0) : 0);
	let weekDays = $derived(getWeekDays(weekOffset));
	let weekLabel = $derived(getWeekLabel(weekDays));
	let weekId = $derived(getWeekId(weekDays));

	$effect(() => {
		if (browser) localStorage.setItem('pm_cart_week', String(weekOffset));
	});

	// ── Агрегация ингредиентов из меню ───────────────────────────────────
	let fridge = $derived((page.data.fridgeItems ?? []) as FridgeRow[]);

	// Карта холодильника: название_lowercase → { qty, unit }
	let fridgeMap = $derived(new Map(fridge.map((f) => [f.product_name.trim().toLowerCase(), f])));

	let groups = $derived.by(() => {
		const plans = (data.menuPlans ?? []) as { week_label: string; dish_name: string }[];
		const names = plans.filter((p) => p.week_label === weekId).map((p) => p.dish_name);
		const customs = (page.data.customDishes ?? []) as CustomDish[];
		const catalog = (page.data.foodCatalog ?? []) as Dish[];
		return aggregateIngredients(names, customs, catalog);
	});

	let allItems = $derived(groups.flatMap((g) => g.items));

	// ── Локальный стейт (инициализируется из БД) ──────────────────────────
	let checked = $state<Set<string>>(
		new Set(
			(data.cartState as CartStateRow[]).filter((r) => r.is_checked).map((r) => r.ingredient_name)
		)
	);
	let prices = $state<Record<string, number>>(
		Object.fromEntries(
			(data.cartState as CartStateRow[])
				.filter((r) => (r.price ?? 0) > 0)
				.map((r) => [r.ingredient_name, r.price ?? 0])
		)
	);

	// ── household_id (нужен для upsert) ──────────────────────────────────
	const householdId: string | null = page.data.householdId ?? null;

	// ── Upsert в Supabase ─────────────────────────────────────────────────
	async function upsertRow(name: string, patch: { price?: number; is_checked?: boolean }) {
		if (!householdId) return;
		const current = (data.cartState as CartStateRow[]).find((r) => r.ingredient_name === name);
		await page.data.supabase.from('cart_state').upsert(
			{
				household_id: householdId,
				week_label: weekId,
				ingredient_name: name,
				price: patch.price ?? current?.price ?? 0,
				is_checked: patch.is_checked ?? current?.is_checked ?? false,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'household_id,week_label,ingredient_name' }
		);
	}

	// ── Чекбокс ───────────────────────────────────────────────────────────
	function toggle(name: string) {
		const next = new Set(checked);
		const nowChecked = !next.has(name);
		nowChecked ? next.add(name) : next.delete(name);
		checked = next;
		upsertRow(name, { is_checked: nowChecked });
	}

	async function resetChecked() {
		checked = new Set();
		if (!householdId) return;
		await page.data.supabase
			.from('cart_state')
			.update({ is_checked: false, updated_at: new Date().toISOString() })
			.eq('household_id', householdId)
			.eq('week_label', weekId);
	}

	// ── Цена ─────────────────────────────────────────────────────────────
	let priceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	function handlePriceInput(name: string, raw: string) {
		const v = parseFloat(raw);
		const val = isNaN(v) ? 0 : v;
		prices = { ...prices, [name]: val };
		clearTimeout(priceTimers[name]);
		priceTimers[name] = setTimeout(() => upsertRow(name, { price: val }), 600);
	}

	// ── Итого ─────────────────────────────────────────────────────────────
	let totalCost = $derived(allItems.reduce((s, i) => s + (prices[i.name] ?? 0), 0));
	let remainingCost = $derived(
		allItems.filter((i) => !checked.has(i.name)).reduce((s, i) => s + (prices[i.name] ?? 0), 0)
	);

	// ── Экспорт ───────────────────────────────────────────────────────────
	let exportToast = $state(false);

	function exportCart() {
		let text = `🛒 Список покупок — ${weekLabel}\n\n`;
		for (const group of groups) {
			const unchecked = group.items.filter((i) => !checked.has(i.name));
			if (unchecked.length === 0) continue;
			text += `${SHOPPING_CATEGORY_LABELS[group.category]}\n`;
			for (const item of unchecked) {
				const price = prices[item.name] ? ` — ${prices[item.name]} ₽` : '';
				text += `  • ${item.name}${price}\n`;
			}
			text += '\n';
		}
		if (totalCost > 0) text += `Всего: ~${totalCost} ₽\n`;
		if (remainingCost > 0 && remainingCost !== totalCost)
			text += `Осталось докупить: ~${remainingCost} ₽\n`;
		navigator.clipboard.writeText(text).then(() => {
			exportToast = true;
			setTimeout(() => (exportToast = false), 2500);
		});
	}

	function sortedItems(items: CartItem[]) {
		return [...items].sort((a, b) => {
			const ac = checked.has(a.name) ? 1 : 0;
			const bc = checked.has(b.name) ? 1 : 0;
			return ac - bc;
		});
	}

	// ── Ручные позиции ────────────────────────────────────────────────
	interface ManualItem {
		name: string;
		qty: number | null;
		unit: string;
		category: ShoppingCategory;
	}

	// Загружаем ручные позиции из cart_state (source === 'manual')
	let manualItems = $state<ManualItem[]>(
		(data.cartState as CartStateRow[])
			.filter((r) => r.source === 'manual')
			.map((r) => ({
				name: r.ingredient_name,
				qty: r.qty,
				unit: r.unit ?? 'шт',
				category: (r.category ?? 'other') as ShoppingCategory
			}))
	);

	const MANUAL_UNITS: string[] = ['г', 'мл', 'шт', 'упак'];

	let addName = $state('');
	let addQty = $state('');
	let addUnit = $state('шт');
	let addCategory = $state<ShoppingCategory>('other');
	let addError = $state('');
	let addSaving = $state(false);

	async function saveManualItem() {
		if (addSaving) return;
		addError = '';
		const name = addName.trim();
		if (!name) {
			addError = 'Введите название';
			return;
		}
		if (!householdId) return;

		addSaving = true;
		const qty = addQty ? Number(addQty) : null;

		const { error } = await page.data.supabase.from('cart_state').upsert(
			{
				household_id: householdId,
				week_label: weekId,
				ingredient_name: name,
				price: 0,
				is_checked: false,
				source: 'manual',
				qty: qty,
				unit: addUnit,
				category: addCategory,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'household_id,week_label,ingredient_name' }
		);

		addSaving = false;

		if (error) {
			addError = error.message;
			return;
		}

		manualItems = [...manualItems, { name, qty, unit: addUnit, category: addCategory }];
		addName = '';
		addQty = '';
		addUnit = 'шт';
		addCategory = 'other';
	}

	async function deleteManualItem(name: string) {
		if (!householdId) return;
		await page.data.supabase
			.from('cart_state')
			.delete()
			.eq('household_id', householdId)
			.eq('week_label', weekId)
			.eq('ingredient_name', name)
			.eq('source', 'manual');
		manualItems = manualItems.filter((i) => i.name !== name);
		const next = new Set(checked);
		next.delete(name);
		checked = next;
	}

	// ── Смешанные группы (меню + ручные) ─────────────────────────────
	let allGroups = $derived.by(() => {
		const grouped = new Map<ShoppingCategory, { items: CartItem[]; manualItems: ManualItem[] }>();

		// Добавляем меню-группы
		for (const g of groups) {
			grouped.set(g.category, { items: g.items, manualItems: [] });
		}

		// Добавляем ручные позиции в нужную категорию
		for (const m of manualItems) {
			const cat = m.category;
			const existing = grouped.get(cat);
			if (existing) {
				grouped.set(cat, { ...existing, manualItems: [...existing.manualItems, m] });
			} else {
				grouped.set(cat, { items: [], manualItems: [m] });
			}
		}

		// Возвращаем в правильном порядке
		return SHOPPING_CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => ({
			category: cat,
			...grouped.get(cat)!
		}));
	});

	let allItemsWithManual = $derived(
		allGroups.flatMap((g) => [...g.items.map((i) => i.name), ...g.manualItems.map((m) => m.name)])
	);
	let totalItemsWithManual = $derived(allItemsWithManual.length);
	let checkedCountAll = $derived(allItemsWithManual.filter((n) => checked.has(n)).length);

	// ── Перенос в холодильник ─────────────────────────────────────────
	let fridgeToast = $state(false);
	let fridgeToastCount = $state(0);
	let fridgeTransferring = $state(false);

	async function transferToFridge() {
		if (!householdId || fridgeTransferring) return;
		fridgeTransferring = true;

		// Собираем все отмеченные позиции (меню + ручные)
		type TransferItem = { name: string; qty: number | null; unit: string };
		const toTransfer: TransferItem[] = [];

		for (const g of allGroups) {
			for (const item of g.items) {
				if (checked.has(item.name)) {
					toTransfer.push({ name: item.name, qty: item.totalQty, unit: item.unit ?? 'шт' });
				}
			}
			for (const m of g.manualItems) {
				if (checked.has(m.name)) {
					toTransfer.push({ name: m.name, qty: m.qty, unit: m.unit });
				}
			}
		}

		if (toTransfer.length === 0) {
			fridgeTransferring = false;
			return;
		}

		// Загружаем текущий холодильник для upsert
		type FridgePickRow = Pick<FridgeRow, 'id' | 'product_name' | 'qty' | 'unit'>;
		const { data: existingRaw } = await page.data.supabase
			.from('household_fridge')
			.select('id, product_name, qty, unit')
			.eq('household_id', householdId);

		const existing: FridgePickRow[] = (existingRaw ?? []) as FridgePickRow[];
		const existingMap = new Map(existing.map((r) => [r.product_name.trim().toLowerCase(), r]));

		for (const item of toTransfer) {
			const key = item.name.trim().toLowerCase();
			const row = existingMap.get(key);
			const qty = item.qty ?? 1;

			if (row) {
				// Суммируем qty если единицы совпадают, иначе просто обновляем
				const newQty = row.unit === item.unit ? row.qty + qty : qty;
				await page.data.supabase
					.from('household_fridge')
					.update({ qty: newQty, unit: item.unit, updated_at: new Date().toISOString() })
					.eq('id', row.id);
			} else {
				await page.data.supabase.from('household_fridge').insert({
					household_id: householdId,
					product_name: item.name.trim(),
					qty,
					unit: item.unit,
					expires_at: null,
					updated_at: new Date().toISOString()
				});
			}
		}

		fridgeTransferring = false;
		fridgeToastCount = toTransfer.length;
		fridgeToast = true;
		setTimeout(() => {
			fridgeToast = false;
		}, 3500);
	}
</script>

<svelte:head><title>Список покупок — MealPlaniX</title></svelte:head>

<div class="pg">
	<!-- ═══ ШАПКА ═══════════════════════════════════════════════════════════ -->
	<header class="hd">
		<!-- Навигация по неделям -->
		<div class="wk-row">
			<button class="wk-btn" onclick={() => weekOffset--} aria-label="Предыдущая неделя">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path
						d="M10 3L5 8l5 5"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			<div class="wk-center">
				<span class="wk-label">{weekLabel}</span>
				<span class="wk-sub">
					{#if weekOffset === 0}Текущая неделя
					{:else if weekOffset === 1}Следующая неделя
					{:else if weekOffset === -1}Прошлая неделя
					{:else}{weekOffset > 0 ? '+' : ''}{weekOffset} нед.
					{/if}
				</span>
			</div>
			<button class="wk-btn" onclick={() => weekOffset++} aria-label="Следующая неделя">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path
						d="M6 3l5 5-5 5"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</div>

		<!-- Прогресс + действия -->
		{#if totalItemsWithManual > 0}
			<div class="hd-meta">
				<div class="prog-wrap">
					<div class="prog-track">
						<div
							class="prog-fill"
							style="width: {Math.round((checkedCountAll / totalItemsWithManual) * 100)}%"
						></div>
					</div>
					<span class="prog-label">{checkedCountAll} / {totalItemsWithManual}</span>
				</div>
				<div class="hd-actions">
					{#if checkedCountAll > 0 && householdId}
						<button
							class="btn-fridge"
							onclick={transferToFridge}
							disabled={fridgeTransferring}
							aria-label="Перенести отмеченное в холодильник"
						>
							<svg width="12" height="13" viewBox="0 0 12 13" fill="none">
								<rect
									x="1"
									y="0.5"
									width="10"
									height="12"
									rx="1.5"
									stroke="currentColor"
									stroke-width="1.4"
								/>
								<path d="M1 5.5h10" stroke="currentColor" stroke-width="1.4" />
								<path
									d="M6 2.5v2.5"
									stroke="currentColor"
									stroke-width="1.4"
									stroke-linecap="round"
								/>
							</svg>
							В холодильник
						</button>
					{/if}
					{#if checkedCountAll > 0}
						<button class="btn-reset" onclick={resetChecked} aria-label="Сбросить все отметки">
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
								<path
									d="M1.5 1.5l9 9M10.5 1.5l-9 9"
									stroke="currentColor"
									stroke-width="1.7"
									stroke-linecap="round"
								/>
							</svg>
							Сбросить
						</button>
					{/if}
					<button class="btn-export" onclick={exportCart}>
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
							<rect
								x="1.5"
								y="4"
								width="7"
								height="8.5"
								rx="1.5"
								stroke="currentColor"
								stroke-width="1.4"
							/>
							<path
								d="M4.5 4V2.5A1 1 0 015.5 1.5h5A1 1 0 0111.5 2.5v8a1 1 0 01-1 1H9"
								stroke="currentColor"
								stroke-width="1.4"
								stroke-linecap="round"
							/>
						</svg>
						Копировать
					</button>
				</div>
			</div>
		{/if}
	</header>

	<!-- ═══ КОНТЕНТ ══════════════════════════════════════════════════════════ -->
	<div class="bd">
		<!-- Пустое состояние -->
		{#if allGroups.length === 0}
			<div class="empty">
				<div class="empty-icon">
					<svg width="36" height="36" viewBox="0 0 36 36" fill="none">
						<path
							d="M6 8h3l4 14h12l3-10H11"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<circle cx="14" cy="25.5" r="1.8" fill="currentColor" />
						<circle cx="22" cy="25.5" r="1.8" fill="currentColor" />
					</svg>
				</div>
				<p class="empty-title">Список покупок пуст</p>
				<p class="empty-desc">
					Сгенерируйте меню на эту неделю —<br />
					ингредиенты появятся здесь автоматически
				</p>
			</div>
		{:else}
			{#each allGroups as group}
				{@const groupAllNames = [
					...group.items.map((i) => i.name),
					...group.manualItems.map((m) => m.name)
				]}
				{@const groupDone = groupAllNames.filter((n) => checked.has(n)).length}
				<section class="cat-sec">
					<!-- Заголовок категории -->
					<div class="cat-hd">
						<div class="cat-icon cat-icon--{group.category}">
							{#if group.category === 'meat'}
								<svg width="13" height="13" viewBox="0 0 13 13" fill="none"
									><path
										d="M9.5 3C8 1.5 5.5 2 4 3.5L2 5.5l2 2 1-1 3.5 3.5-1 1L9 13l2.5-2.5C13 9 12.5 6 11 4.5"
										stroke="currentColor"
										stroke-width="1.3"
										stroke-linecap="round"
									/></svg
								>
							{:else if group.category === 'dairy'}
								<svg width="13" height="13" viewBox="0 0 13 13" fill="none"
									><path
										d="M4.5 2h4l1.5 2.5H3L4.5 2z"
										stroke="currentColor"
										stroke-width="1.3"
										stroke-linecap="round"
										stroke-linejoin="round"
									/><path
										d="M3 4.5L2.5 11a.5.5 0 00.5.5h7a.5.5 0 00.5-.5L10 4.5H3z"
										stroke="currentColor"
										stroke-width="1.3"
									/><path
										d="M5 7.5h3"
										stroke="currentColor"
										stroke-width="1.3"
										stroke-linecap="round"
									/></svg
								>
							{:else if group.category === 'grain'}
								<svg width="13" height="13" viewBox="0 0 13 13" fill="none"
									><path
										d="M6.5 11.5V5"
										stroke="currentColor"
										stroke-width="1.3"
										stroke-linecap="round"
									/><ellipse
										cx="6.5"
										cy="4"
										rx="2.5"
										ry="1.5"
										stroke="currentColor"
										stroke-width="1.3"
									/><path
										d="M4 7c-1.5 0-2.5-1-2.5-2.5"
										stroke="currentColor"
										stroke-width="1.3"
										stroke-linecap="round"
									/><path
										d="M9 7c1.5 0 2.5-1 2.5-2.5"
										stroke="currentColor"
										stroke-width="1.3"
										stroke-linecap="round"
									/></svg
								>
							{:else if group.category === 'vegetable'}
								<svg width="13" height="13" viewBox="0 0 13 13" fill="none"
									><path
										d="M6.5 11.5V6"
										stroke="currentColor"
										stroke-width="1.3"
										stroke-linecap="round"
									/><path
										d="M6.5 6C5 6 2 4 3 1.5c2.5 0 4 2 3.5 4.5z"
										stroke="currentColor"
										stroke-width="1.3"
										fill="currentColor"
										fill-opacity="0.15"
									/><path
										d="M6.5 8c1.5 0 4.5-2 3.5-4.5C7.5 3.5 6 5.5 6.5 8z"
										stroke="currentColor"
										stroke-width="1.3"
										fill="currentColor"
										fill-opacity="0.15"
									/></svg
								>
							{:else if group.category === 'fruit'}
								<svg width="13" height="13" viewBox="0 0 13 13" fill="none"
									><circle cx="6.5" cy="8" r="3.5" stroke="currentColor" stroke-width="1.3" /><path
										d="M6.5 4.5V3M5.5 3c0-1 2-1 2 0"
										stroke="currentColor"
										stroke-width="1.3"
										stroke-linecap="round"
									/></svg
								>
							{:else if group.category === 'condiment'}
								<svg width="13" height="13" viewBox="0 0 13 13" fill="none"
									><path
										d="M5 2h3v2.5l1.5 1.5H3.5L5 4.5V2z"
										stroke="currentColor"
										stroke-width="1.3"
										stroke-linecap="round"
										stroke-linejoin="round"
									/><path
										d="M3.5 6l-.5 5a.5.5 0 00.5.5h5.5a.5.5 0 00.5-.5L9 6"
										stroke="currentColor"
										stroke-width="1.3"
									/></svg
								>
							{:else}
								<svg width="13" height="13" viewBox="0 0 13 13" fill="none"
									><rect
										x="1.5"
										y="1.5"
										width="10"
										height="10"
										rx="2"
										stroke="currentColor"
										stroke-width="1.3"
									/><path
										d="M4 6.5h5M4 4.5h3"
										stroke="currentColor"
										stroke-width="1.3"
										stroke-linecap="round"
									/></svg
								>
							{/if}
						</div>
						<span class="cat-name">{SHOPPING_CATEGORY_LABELS[group.category]}</span>
						<div class="cat-dots" aria-hidden="true">
							{#each groupAllNames as _, dotIdx}
								<span class="cat-dot" class:cat-dot--on={dotIdx < groupDone}></span>
							{/each}
						</div>
						<span class="cat-count">
							{groupDone}/{groupAllNames.length}
						</span>
					</div>

					<!-- Строки товаров -->
					<div class="item-list">
						{#each sortedItems(group.items) as item, idx (item.name)}
							{@const isChecked = checked.has(item.name)}
							{@const fridgeEntry = fridgeMap.get(item.name.trim().toLowerCase())}
							{@const needQty =
								item.totalQty != null && fridgeEntry && fridgeEntry.unit === item.unit
									? Math.max(0, item.totalQty - fridgeEntry.qty)
									: item.totalQty}
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
							<div
								class="item-row"
								class:item-row--done={isChecked}
								class:item-row--last={idx === group.items.length - 1 &&
									group.manualItems.length === 0}
								onclick={() => toggle(item.name)}
							>
								<!-- Чекбокс -->
								<div class="item-cb" class:item-cb--on={isChecked}>
									{#if isChecked}
										<svg width="9" height="7" viewBox="0 0 9 7" fill="none">
											<path
												d="M1 3.5l2 2.5 5-5"
												stroke="white"
												stroke-width="1.8"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									{/if}
								</div>

								<!-- Данные -->
								<div class="item-body">
									<div class="item-top">
										<span class="item-name" class:item-name--done={isChecked}>{item.name}</span>
										{#if item.totalQty != null && item.unit}
											<span class="item-qty" class:item-qty--done={isChecked}>
												{item.totalQty % 1 === 0 ? item.totalQty : item.totalQty.toFixed(1)}
												{item.unit}
											</span>
										{/if}
										{#if fridgeEntry && item.unit && fridgeEntry.unit === item.unit}
											<span class="item-fridge">
												<svg width="9" height="10" viewBox="0 0 9 10" fill="none">
													<rect
														x="1"
														y="0.5"
														width="7"
														height="9"
														rx="1.2"
														stroke="currentColor"
														stroke-width="1.2"
													/>
													<path d="M1 4h7" stroke="currentColor" stroke-width="1.2" />
													<path
														d="M4.5 2v1.5"
														stroke="currentColor"
														stroke-width="1.2"
														stroke-linecap="round"
													/>
												</svg>
												−{fridgeEntry.qty}
												{fridgeEntry.unit}
											</span>
										{/if}
										{#if needQty != null && item.unit && !isChecked}
											<span class="item-need" class:item-need--zero={needQty === 0}>
												{needQty === 0
													? '✓ есть'
													: `= ${needQty % 1 === 0 ? needQty : needQty.toFixed(1)} ${item.unit}`}
											</span>
										{/if}
									</div>
									{#if item.sources.length > 0 && !isChecked}
										<div class="item-srcs">
											{#each item.sources as src}
												<span class="item-src">{src}</span>
											{/each}
										</div>
									{/if}
								</div>

								<!-- Цена -->
								{#if !isChecked}
									<div class="price-wrap">
										<input
											type="number"
											min="0"
											placeholder="—"
											value={prices[item.name] ?? ''}
											onclick={(e) => e.stopPropagation()}
											oninput={(e) =>
												handlePriceInput(item.name, (e.currentTarget as HTMLInputElement).value)}
											class="price-input"
											aria-label="Цена {item.name}"
										/>
										<span class="price-cur">₽</span>
									</div>
								{:else if prices[item.name]}
									<span class="price-done">{prices[item.name]} ₽</span>
								{/if}
							</div>
						{/each}

						<!-- Ручные позиции в этой категории -->
						{#each group.manualItems as mItem, mIdx (mItem.name)}
							{@const isChecked = checked.has(mItem.name)}
							<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
							<div
								class="item-row"
								class:item-row--last={mIdx === group.manualItems.length - 1}
								class:item-row--done={isChecked}
								onclick={() => toggle(mItem.name)}
							>
								<div class="item-cb" class:item-cb--on={isChecked}>
									{#if isChecked}
										<svg width="9" height="7" viewBox="0 0 9 7" fill="none">
											<path
												d="M1 3.5l2 2.5 5-5"
												stroke="white"
												stroke-width="1.8"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									{/if}
								</div>
								<div class="item-body">
									<div class="item-top">
										<span class="item-name" class:item-name--done={isChecked}>{mItem.name}</span>
										{#if mItem.qty != null}
											<span class="item-qty" class:item-qty--done={isChecked}
												>{mItem.qty} {mItem.unit}</span
											>
										{/if}
										<span class="item-manual-badge">вручную</span>
									</div>
								</div>
								<button
									class="btn-del-manual"
									onclick={(e) => {
										e.stopPropagation();
										deleteManualItem(mItem.name);
									}}
									aria-label="Удалить {mItem.name}"
								>
									<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
										<path
											d="M1.5 1.5l9 9M10.5 1.5l-9 9"
											stroke="currentColor"
											stroke-width="1.7"
											stroke-linecap="round"
										/>
									</svg>
								</button>
							</div>
						{/each}
					</div>
				</section>
			{/each}

			<!-- ─── Форма добавления ручной позиции ───────────────────────────── -->
			{#if householdId}
				<section class="add-manual-sec">
					<div class="add-manual-title">Добавить вручную</div>
					<div class="add-manual-form">
						<input
							type="text"
							class="add-input add-input--name"
							placeholder="Название"
							bind:value={addName}
							aria-label="Название товара"
						/>
						<input
							type="number"
							class="add-input add-input--qty"
							placeholder="Кол-во"
							min="0"
							bind:value={addQty}
							aria-label="Количество"
						/>
						<select class="add-select" bind:value={addUnit} aria-label="Единица измерения">
							{#each MANUAL_UNITS as u}
								<option value={u}>{u}</option>
							{/each}
						</select>
						<select
							class="add-select add-select--cat"
							bind:value={addCategory}
							aria-label="Категория"
						>
							{#each SHOPPING_CATEGORY_ORDER as cat}
								<option value={cat}>{SHOPPING_CATEGORY_LABELS[cat]}</option>
							{/each}
						</select>
						<button class="btn-add-manual" onclick={saveManualItem} disabled={addSaving}>
							{#if addSaving}
								<svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="spin"
									><circle
										cx="7"
										cy="7"
										r="5.5"
										stroke="currentColor"
										stroke-width="1.5"
										stroke-dasharray="20 15"
									/></svg
								>
							{:else}
								<svg width="14" height="14" viewBox="0 0 14 14" fill="none"
									><path
										d="M7 2v10M2 7h10"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
									/></svg
								>
							{/if}
							Добавить
						</button>
					</div>
					{#if addError}
						<p class="add-error">{addError}</p>
					{/if}
				</section>
			{/if}

			<div class="bd-spacer"></div>
		{/if}
	</div>
</div>

<!-- ═══ ПАНЕЛЬ ИТОГО ══════════════════════════════════════════════════════ -->
{#if totalItemsWithManual > 0}
	<div class="summary" aria-label="Итого по корзине">
		<div class="summary-cell">
			<span class="summary-lbl">Всего</span>
			<span class="summary-val">{totalCost} ₽</span>
		</div>
		<div class="summary-div"></div>
		<div class="summary-cell summary-cell--accent">
			<span class="summary-lbl">Осталось</span>
			<span class="summary-val">{remainingCost} ₽</span>
		</div>
	</div>
{/if}

<!-- ═══ TOAST ══════════════════════════════════════════════════════════════ -->
{#if exportToast}
	<div class="toast" role="status" aria-live="polite">
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
			<path
				d="M2 7l3.5 4L12 3"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		Скопировано в буфер
	</div>
{/if}

{#if fridgeToast}
	<div class="toast toast--fridge" role="status" aria-live="polite">
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
			<path
				d="M2 7l3.5 4L12 3"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		Добавлено {fridgeToastCount}
		{fridgeToastCount === 1 ? 'позиция' : fridgeToastCount < 5 ? 'позиции' : 'позиций'} в холодильник
		&nbsp;<a href="/fridge" class="toast-link">Перейти</a>
	</div>
{/if}

<style>
	/* ── PAGE ─────────────────────────────────────────────────────────── */
	.pg {
		min-height: 100vh;
		background: var(--color-bg-page);
		display: flex;
		flex-direction: column;
	}

	/* ── HEADER ───────────────────────────────────────────────────────── */
	.hd {
		position: sticky;
		top: 0;
		z-index: var(--z-sticky);
		background: var(--color-bg-card);
		padding: 0 16px;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
	}

	/* Week nav */
	.wk-row {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 56px;
		margin-bottom: 0;
		border-bottom: 1px solid var(--color-border);
	}
	.wk-btn {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-md);
		border: 1.5px solid var(--color-border);
		background: var(--color-bg-page);
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: all var(--transition-fast);
	}
	.wk-btn:hover {
		background: var(--color-green-tint);
		border-color: var(--color-green-tint-border);
		color: var(--color-green-primary);
	}
	.wk-center {
		flex: 1;
		text-align: center;
	}
	.wk-label {
		display: block;
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text-primary);
		letter-spacing: -0.01em;
	}
	.wk-sub {
		display: block;
		font-size: 11px;
		color: var(--color-text-muted);
		margin-top: 1px;
	}

	/* Progress + actions row */
	.hd-meta {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 0 12px;
		border-bottom: 1px solid var(--color-border);
	}
	.prog-wrap {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.prog-track {
		flex: 1;
		height: 5px;
		background: var(--color-border);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}
	.prog-fill {
		height: 100%;
		background: var(--color-green-primary);
		border-radius: var(--radius-pill);
		transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.prog-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
		white-space: nowrap;
		flex-shrink: 0;
		min-width: 36px;
		text-align: right;
	}
	.hd-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.btn-reset {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 10px;
		border-radius: var(--radius-sm);
		border: 1.5px solid var(--color-border);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 12px;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		transition: all var(--transition-fast);
	}
	.btn-reset:hover {
		background: var(--color-error-bg);
		color: var(--color-error);
		border-color: var(--color-error-border);
	}
	.btn-export {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 12px;
		border-radius: var(--radius-sm);
		border: none;
		background: var(--color-green-primary);
		color: #fff;
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background var(--transition-fast);
	}
	.btn-export:hover {
		background: var(--color-green-dark);
	}

	/* ── BODY ─────────────────────────────────────────────────────────── */
	.bd {
		flex: 1;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.bd-spacer {
		height: 72px;
	}

	/* ── EMPTY STATE ──────────────────────────────────────────────────── */
	.empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 24px;
		gap: 12px;
	}
	.empty-icon {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: var(--color-green-tint);
		border: 1px solid var(--color-green-tint-border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-green-primary);
		margin-bottom: 4px;
	}
	.empty-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--color-text-primary);
		margin: 0;
	}
	.empty-desc {
		font-size: 13px;
		color: var(--color-text-muted);
		text-align: center;
		line-height: 1.65;
		margin: 0;
	}

	/* ── CATEGORY SECTION ─────────────────────────────────────────────── */
	.cat-sec {
	}

	.cat-hd {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 0 2px;
		margin-bottom: 7px;
	}
	.cat-icon {
		width: 26px;
		height: 26px;
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.cat-icon--meat {
		background: rgba(224, 123, 57, 0.13);
		color: var(--cat-meat-text);
	}
	.cat-icon--dairy {
		background: rgba(196, 148, 58, 0.13);
		color: var(--cat-dairy-text);
	}
	.cat-icon--grain {
		background: rgba(180, 150, 80, 0.13);
		color: var(--cat-grain-text);
	}
	.cat-icon--vegetable {
		background: var(--color-green-tint);
		color: var(--cat-vegetable-text);
	}
	.cat-icon--fruit {
		background: rgba(190, 60, 110, 0.11);
		color: var(--cat-fruit-text);
	}
	.cat-icon--condiment {
		background: rgba(74, 127, 193, 0.11);
		color: var(--cat-condiment-text);
	}
	.cat-icon--other {
		background: rgba(107, 117, 104, 0.1);
		color: var(--cat-other-text);
	}

	.cat-name {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}
	.cat-dots {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 3px;
		margin: 0 6px;
		overflow: hidden;
	}
	.cat-dot {
		flex: 1;
		height: 3px;
		border-radius: 2px;
		background: var(--color-border);
		max-width: 16px;
		transition: background var(--transition-fast);
	}
	.cat-dot--on {
		background: var(--color-green-primary);
	}
	.cat-count {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
		flex-shrink: 0;
		min-width: 24px;
		text-align: right;
	}

	/* ── ITEM LIST ────────────────────────────────────────────────────── */
	.item-list {
		background: var(--color-bg-card);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		overflow: hidden;
	}

	.item-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 11px 14px;
		border-bottom: 1px solid var(--color-border);
		cursor: pointer;
		transition: background var(--transition-fast);
		background: var(--color-bg-card);
	}
	.item-row:hover {
		background: var(--color-green-tint);
	}
	.item-row--done {
		background: var(--color-bg-page);
	}
	.item-row--done:hover {
		background: var(--color-bg-page);
	}
	.item-row--last {
		border-bottom: none;
	}

	/* Checkbox */
	.item-cb {
		width: 18px;
		height: 18px;
		border-radius: 5px;
		border: 2px solid var(--color-border);
		background: transparent;
		flex-shrink: 0;
		margin-top: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition-fast);
	}
	.item-cb--on {
		background: var(--color-green-primary);
		border-color: var(--color-green-primary);
	}

	/* Item body */
	.item-body {
		flex: 1;
		min-width: 0;
	}
	.item-top {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 5px;
	}

	.item-name {
		font-size: 14px;
		font-weight: 500;
		color: var(--color-text-primary);
		transition:
			color var(--transition-fast),
			text-decoration var(--transition-fast);
		line-height: 1.4;
	}
	.item-name--done {
		color: var(--color-text-muted);
		text-decoration: line-through;
	}
	.item-qty {
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.item-qty--done {
		text-decoration: line-through;
	}

	.item-fridge {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 11px;
		color: var(--color-blue-text);
		background: var(--color-blue-tint);
		border-radius: 4px;
		padding: 1px 5px;
	}
	.item-need {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-green-primary);
		background: var(--color-green-tint);
		border-radius: 4px;
		padding: 1px 5px;
	}
	.item-need--zero {
		color: var(--color-success);
		background: rgba(26, 158, 94, 0.1);
	}

	.item-srcs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 5px;
	}
	.item-src {
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 4px;
		background: var(--color-green-tint);
		color: var(--color-green-primary);
		white-space: nowrap;
	}

	/* Price */
	.price-wrap {
		display: flex;
		align-items: center;
		gap: 3px;
		flex-shrink: 0;
	}
	.price-input {
		width: 58px;
		padding: 4px 6px;
		font-size: 13px;
		text-align: right;
		font-family: inherit;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-page);
		color: var(--color-text-primary);
		outline: none;
		transition: border-color var(--transition-fast);
	}
	.price-input:focus {
		border-color: var(--color-green-primary);
	}
	.price-cur {
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.price-done {
		font-size: 12px;
		color: var(--color-text-muted);
		text-decoration: line-through;
		flex-shrink: 0;
	}

	/* ── SUMMARY PANEL ────────────────────────────────────────────────── */
	.summary {
		position: fixed;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: stretch;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-modal);
		overflow: hidden;
		z-index: var(--z-sticky);
	}
	.summary-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 9px 22px;
		gap: 1px;
	}
	.summary-cell--accent {
		background: var(--color-green-primary);
	}
	.summary-lbl {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--color-text-muted);
	}
	.summary-cell--accent .summary-lbl {
		color: rgba(255, 255, 255, 0.65);
	}
	.summary-val {
		font-size: 17px;
		font-weight: 700;
		color: var(--color-text-primary);
		letter-spacing: -0.02em;
	}
	.summary-cell--accent .summary-val {
		color: #fff;
	}
	.summary-div {
		width: 1px;
		background: var(--color-border);
		margin: 8px 0;
		flex-shrink: 0;
	}

	/* ── TOAST ────────────────────────────────────────────────────────── */
	.toast {
		position: fixed;
		bottom: 88px;
		left: 50%;
		transform: translateX(-50%);
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 9px 18px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-text-inverse);
		font-size: 13px;
		font-weight: 600;
		z-index: var(--z-toast);
		white-space: nowrap;
		box-shadow: var(--shadow-modal);
		animation: toast-up 0.22s ease;
	}
	@keyframes toast-up {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.prog-fill,
		.item-cb,
		.item-row,
		.cat-dot {
			transition: none !important;
		}
		.toast {
			animation: none;
		}
	}

	/* ── FRIDGE BUTTON ────────────────────────────────────────────────── */
	.btn-fridge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		border-radius: var(--radius-sm);
		border: 1.5px solid var(--color-blue-border);
		background: var(--color-blue-tint);
		color: var(--color-blue-text);
		font-size: 12px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: all var(--transition-fast);
	}
	.btn-fridge:hover:not(:disabled) {
		background: var(--color-blue-tint);
		border-color: var(--color-blue-light);
	}
	.btn-fridge:disabled {
		opacity: 0.6;
		cursor: default;
	}

	/* ── MANUAL ITEM BADGE ────────────────────────────────────────────── */
	.item-manual-badge {
		display: inline-block;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		background: var(--color-bg-page);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 1px 5px;
		opacity: 0.7;
	}

	/* ── DELETE MANUAL BUTTON ─────────────────────────────────────────── */
	.btn-del-manual {
		width: 26px;
		height: 26px;
		border-radius: var(--radius-sm);
		border: 1.5px solid var(--color-border);
		background: transparent;
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: all var(--transition-fast);
	}
	.btn-del-manual:hover {
		background: var(--color-error-bg);
		color: var(--color-error);
		border-color: var(--color-error-border);
	}

	/* ── ADD MANUAL FORM ──────────────────────────────────────────────── */
	.add-manual-sec {
		background: var(--color-bg-card);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		padding: 14px 16px;
	}
	.add-manual-title {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--color-text-muted);
		margin-bottom: 10px;
	}
	.add-manual-form {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		align-items: center;
	}
	.add-input {
		padding: 6px 10px;
		font-size: 13px;
		font-family: inherit;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-page);
		color: var(--color-text-primary);
		outline: none;
		transition: border-color var(--transition-fast);
	}
	.add-input:focus {
		border-color: var(--color-green-primary);
	}
	.add-input--name {
		flex: 1;
		min-width: 120px;
	}
	.add-input--qty {
		width: 72px;
	}
	.add-select {
		padding: 6px 8px;
		font-size: 13px;
		font-family: inherit;
		border: 1.5px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-page);
		color: var(--color-text-primary);
		outline: none;
		cursor: pointer;
		transition: border-color var(--transition-fast);
	}
	.add-select:focus {
		border-color: var(--color-green-primary);
	}
	.add-select--cat {
		flex: 1;
		min-width: 120px;
	}
	.btn-add-manual {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 14px;
		border-radius: var(--radius-sm);
		border: none;
		background: var(--color-green-primary);
		color: var(--color-text-inverse);
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		transition: background var(--transition-fast);
		white-space: nowrap;
	}
	.btn-add-manual:hover:not(:disabled) {
		background: var(--color-green-dark);
	}
	.btn-add-manual:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.add-error {
		margin: 8px 0 0;
		font-size: 12px;
		color: var(--color-error);
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.spin {
		animation: spin 0.8s linear infinite;
	}

	/* ── FRIDGE TOAST ─────────────────────────────────────────────────── */
	.toast--fridge {
		background: var(--color-blue-text);
		color: var(--color-text-inverse);
	}
	.toast-link {
		color: var(--color-text-inverse);
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>
