<script lang="ts">
	import { page } from '$app/state';
	import {
		getWeekDays,
		getWeekLabel,
		getWeekId,
		isToday,
		DAY_SHORT,
		DAY_FULL,
		MONTH_SHORT,
		MEAL_KEYS,
		MEAL_LABELS,
		type MealKey
	} from '$lib/utils/week.js';
	import type { Persona } from '$lib/types/database.js';
	import type { PageData } from './$types.js';
	import type { MenuPlanRow } from './+page.server.js';
	import MealCard from '$lib/components/MealCard.svelte';
	import MealModal from '$lib/components/MealModal.svelte';
	import SmartReplaceModal from '$lib/components/SmartReplaceModal.svelte';
	import FridgeSelectModal from '$lib/components/FridgeSelectModal.svelte';
	import DishDetailModal from '$lib/components/DishDetailModal.svelte';
	import type { Dish } from '$lib/types/dish.js';
	import { generateWeekPlan, buildFridgeHints, customToDish } from '$lib/utils/generate.js';
	import type { FridgeRow } from '$lib/types/database.js';
	import type { FridgeHint } from '$lib/utils/generate.js';
	import { tick } from 'svelte';
	import { browser } from '$app/environment';

	let { data } = $props<{ data: PageData }>();

	// ── Режим просмотра (persist через localStorage) ──────────────────────
	type ViewMode = 'week' | 'day';
	let viewMode = $state<ViewMode>(
		browser && localStorage.getItem('pm_view') === 'day' ? 'day' : 'week'
	);
	let viewDayIdx = $state(
		browser ? Math.max(0, Math.min(6, Number(localStorage.getItem('pm_day') ?? 0))) : 0
	);

	// ── Навигация по неделям (persist через localStorage) ─────────────────
	let weekOffset = $state(browser ? Number(localStorage.getItem('pm_week') ?? 0) : 0);

	// Синхронизация стейта → localStorage
	$effect(() => {
		if (!browser) return;
		localStorage.setItem('pm_view', viewMode);
		localStorage.setItem('pm_day', String(viewDayIdx));
		localStorage.setItem('pm_week', String(weekOffset));
	});

	// Очистка таймеров toast при уничтожении компонента
	$effect(() => {
		return () => {
			if (toast?.timer) clearTimeout(toast.timer);
			if (toast?.tickInterval) clearInterval(toast.tickInterval);
		};
	});
	let weekDays = $derived(getWeekDays(weekOffset));
	let weekLabel = $derived(getWeekLabel(weekDays));
	let weekId = $derived(getWeekId(weekDays));

	let viewDay = $derived(weekDays[viewDayIdx]);

	function dayNavLabel(d: Date): string {
		return `${DAY_FULL[viewDayIdx]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
	}

	function switchView(mode: ViewMode) {
		if (mode === 'day') {
			weekOffset = 0; // всегда возвращаемся на текущую неделю
			const todayIdx = getWeekDays(0).findIndex((d) => isToday(d));
			viewDayIdx = todayIdx >= 0 ? todayIdx : 0;
		}
		viewMode = mode;
	}

	function prevPeriod() {
		if (viewMode === 'week') {
			weekOffset--;
		} else if (viewDayIdx > 0) {
			viewDayIdx--;
		} else {
			weekOffset--;
			viewDayIdx = 6;
		}
	}

	function nextPeriod() {
		if (viewMode === 'week') {
			weekOffset++;
		} else if (viewDayIdx < 6) {
			viewDayIdx++;
		} else {
			weekOffset++;
			viewDayIdx = 0;
		}
	}

	// ── Персоны ───────────────────────────────────────────────────────────
	let personas = $derived(page.data.personas as Persona[]);
	let activeId = $state<number>(page.data.persona?.id ?? 0);
	let activePersona = $derived(personas.find((p) => p.id === activeId) ?? personas[0]);
	// true только если активная персона принадлежит собственному хозяйству текущего пользователя
	let canEdit = $derived(
		!!activePersona && activePersona.household_id === page.data.ownHouseholdId
	);

	function initials(name: string): string {
		return name
			.trim()
			.split(/\s+/)
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	// ── Планы меню ────────────────────────────────────────────────────────
	type SlotKey = string;

	function slotKey(personaId: number, wId: string, dayIdx: number, meal: MealKey): SlotKey {
		return `${personaId}__${wId}__${dayIdx}__${meal}`;
	}

	// Локальный стейт: один слот → массив блюд (несколько блюд на приём)
	let localPlans = $state<Map<SlotKey, MenuPlanRow[]>>(new Map());

	$effect(() => {
		const map = new Map<SlotKey, MenuPlanRow[]>();
		for (const row of (data.menuPlans ?? []) as MenuPlanRow[]) {
			const key = `${row.persona_id}__${row.week_label}__${row.day_index}__${row.meal_key}`;
			const arr = map.get(key) ?? [];
			arr.push(row);
			map.set(key, arr);
		}
		localPlans = map;
	});

	// ── MealModal ─────────────────────────────────────────────────────────
	interface OpenSlot {
		dayIdx: number;
		meal: MealKey;
		dayLabel: string;
	}
	let openSlot = $state<OpenSlot | null>(null);
	let replacingPlan = $state<MenuPlanRow | null>(null); // план, который заменяем
	let smartReplacePlan = $state<MenuPlanRow | null>(null);
	let fridgeModalOpen = $state(false);
	let splitDropOpen   = $state(false);

	const fridgeItems = $derived((page.data.fridgeItems ?? []) as FridgeRow[]);
	const hasFridge   = $derived(fridgeItems.length > 0);

	function openModal(dayIdx: number, meal: MealKey) {
		openSlot = {
			dayIdx,
			meal,
			dayLabel: `${DAY_SHORT[dayIdx]}, ${weekDays[dayIdx].getDate()}`
		};
	}

	// ── DishDetailModal ───────────────────────────────────────────────────
	let detailPlan = $state<MenuPlanRow | null>(null);

	function openDetail(plan: MenuPlanRow) {
		detailPlan = plan;
	}

	function handleDetailReplace(plan: MenuPlanRow) {
		detailPlan = null;
		smartReplacePlan = plan;
	}

	function handleSmartReplace(dish: Dish, grams: number) {
		if (!smartReplacePlan || !activePersona) return;
		const plan = smartReplacePlan;
		smartReplacePlan = null;
		replacingPlan = plan;
		openSlot = {
			dayIdx: plan.day_index,
			meal: plan.meal_key as MealKey,
			dayLabel: `${DAY_SHORT[plan.day_index]}, ${weekDays[plan.day_index].getDate()}`
		};
		handleSelect(dish, grams);
	}

	function handleSmartReplaceManual() {
		if (!smartReplacePlan) return;
		const plan = smartReplacePlan;
		smartReplacePlan = null;
		replacingPlan = plan;
		openSlot = {
			dayIdx: plan.day_index,
			meal: plan.meal_key as MealKey,
			dayLabel: `${DAY_SHORT[plan.day_index]}, ${weekDays[plan.day_index].getDate()}`
		};
	}

	async function handleSelect(dish: Dish, grams: number) {
		if (!openSlot || !activePersona) return;

		const key = slotKey(activePersona.id, weekId, openSlot.dayIdx, openSlot.meal);
		const existing = localPlans.get(key) ?? [];
		const slot = openSlot;
		const oldPlan = replacingPlan;

		openSlot = null;
		replacingPlan = null;

		const k = grams / 100;

		// Оптимистично: при замене — убираем старое, добавляем новое
		const base = oldPlan ? existing.filter((r) => r.id !== oldPlan.id) : existing;

		const tempRow: MenuPlanRow = {
			id: -1,
			persona_id: activePersona.id,
			week_label: weekId,
			day_index: slot.dayIdx,
			meal_key: slot.meal,
			dish_name: dish.name,
			dish_photo: dish.photo ?? null,
			dish_category: dish.category,
			kcal: Math.round(dish.kcal_per_100g * k),
			protein: Math.round(dish.protein_per_100g * k),
			fat: Math.round(dish.fat_per_100g * k),
			carbs: Math.round(dish.carbs_per_100g * k),
			cost: Math.round(dish.cost_per_100g * k),
			grams,
			sort_order: base.length
		};
		localPlans = new Map(localPlans).set(key, [...base, tempRow]);

		// INSERT новое
		const { data: inserted } = await page.data.supabase
			.from('menu_plans')
			.insert({
				persona_id: activePersona.id,
				week_label: weekId,
				day_index: slot.dayIdx,
				meal_key: slot.meal,
				dish_name: dish.name,
				dish_photo: dish.photo ?? null,
				dish_category: dish.category,
				kcal: tempRow.kcal,
				protein: tempRow.protein,
				fat: tempRow.fat,
				carbs: tempRow.carbs,
				cost: tempRow.cost,
				grams,
				sort_order: base.length
			})
			.select('id')
			.single();

		// DELETE старое (если замена)
		if (oldPlan && oldPlan.id > 0) {
			await page.data.supabase.from('menu_plans').delete().eq('id', oldPlan.id);
		}

		// Обновляем tempRow реальным id
		if (inserted) {
			const current = localPlans.get(key) ?? [];
			const updated = current.map((r) => (r.id === -1 ? { ...r, id: inserted.id } : r));
			localPlans = new Map(localPlans).set(key, updated);
		}
	}

	async function handleRemove(row: MenuPlanRow) {
		const key = slotKey(row.persona_id, row.week_label, row.day_index, row.meal_key as MealKey);
		const current = localPlans.get(key) ?? [];
		const updated = current.filter((r) => r.id !== row.id);
		const next = new Map(localPlans);
		if (updated.length === 0) next.delete(key);
		else next.set(key, updated);
		localPlans = next;
		await page.data.supabase.from('menu_plans').delete().eq('id', row.id);
	}

	// ── Копирование недели / дня ──────────────────────────────────────────
	type CopyTarget = 'next' | 'manual';
	type CopyTab = 'toWeek' | 'fromPersona';
	type MergeMode = 'replace' | 'fill';

	// Week copy
	let showCopyWeekPopover = $state(false);
	let copyWeekTab = $state<CopyTab>('toWeek');
	let copyWeekTarget = $state<CopyTarget>('next');
	let copyWeekManual = $state('');
	let copyWeekConfirm = $state(false);
	let copyWeekPending = $state<{ targetWeekId: string } | null>(null);
	let copyingWeek = $state(false);

	// Cross-persona copy
	let copyFromPersonaId = $state<number | null>(null);
	let copyFromSourceWeek = $state<'current' | 'prev'>('current');
	let copyFromMergeMode = $state<MergeMode>('replace');
	let copyFromConfirm = $state(false);
	let copyFromPending = $state<{
		sourcePersonaId: number;
		sourcePersonaName: string;
		sourceWeekId: string;
		mergeMode: MergeMode;
		previewCount: number;
	} | null>(null);

	// Day copy
	let showCopyDayPopover = $state(false);
	type DayCopyMode = 'tomorrow' | 'nextweek' | 'manual';
	let copyDayMode = $state<DayCopyMode>('tomorrow');
	let copyDayManualWeek = $state('');
	let copyDayManualIdx = $state(0);
	let copyDayConfirm = $state(false);
	let copyDayPending = $state<{ targetWeekId: string; targetDayIdx: number } | null>(null);
	let copyingDay = $state(false);

	// Toast / undo
	interface ToastState {
		message: string;
		insertedIds: number[];
		timer: ReturnType<typeof setTimeout> | null;
		secondsLeft: number;
		tickInterval: ReturnType<typeof setInterval> | null;
	}
	let toast = $state<ToastState | null>(null);

	function showToast(message: string, insertedIds: number[]) {
		if (toast?.timer) clearTimeout(toast.timer);
		if (toast?.tickInterval) clearInterval(toast.tickInterval);
		const DURATION = 5000;
		const timer = setTimeout(() => dismissToast(), DURATION);
		const tickInterval = setInterval(() => {
			if (toast) toast.secondsLeft = Math.max(0, toast.secondsLeft - 1);
		}, 1000);
		toast = { message, insertedIds, timer, secondsLeft: 5, tickInterval };
	}

	function dismissToast() {
		if (toast?.timer) clearTimeout(toast.timer);
		if (toast?.tickInterval) clearInterval(toast.tickInterval);
		toast = null;
	}

	function showErrorToast(message: string) {
		if (toast?.timer) clearTimeout(toast.timer);
		if (toast?.tickInterval) clearInterval(toast.tickInterval);
		const DURATION = 4000;
		const timer = setTimeout(() => dismissToast(), DURATION);
		toast = { message, insertedIds: [], timer, secondsLeft: 0, tickInterval: null };
	}

	async function undoCopy() {
		if (!toast) return;
		const ids = toast.insertedIds;
		dismissToast();
		if (ids.length === 0) return;
		// Remove from localPlans
		const next = new Map(localPlans);
		for (const [k, arr] of next) {
			const filtered = arr.filter((r) => !ids.includes(r.id));
			if (filtered.length === 0) next.delete(k);
			else next.set(k, filtered);
		}
		localPlans = next;
		// Delete from DB
		await page.data.supabase.from('menu_plans').delete().in('id', ids);
	}

	/** Returns week_label for offset from current weekId */
	function offsetWeekId(baseWeekId: string, offsetWeeks: number): string {
		// parse "2026-W15" → date of Monday → add 7*offset days
		const match = /^(\d{4})-W(\d{2})$/.exec(baseWeekId);
		if (!match) return baseWeekId;
		const year = parseInt(match[1]);
		const week = parseInt(match[2]);
		// ISO week monday: Jan 4 is always in week 1
		const jan4 = new Date(year, 0, 4);
		const jan4Day = jan4.getDay() === 0 ? 7 : jan4.getDay(); // 1=Mon..7=Sun
		const monday = new Date(jan4);
		monday.setDate(jan4.getDate() - (jan4Day - 1) + (week - 1) * 7);
		monday.setDate(monday.getDate() + offsetWeeks * 7);
		return getWeekId([
			monday,
			...Array.from({ length: 6 }, (_, i) => {
				const d = new Date(monday);
				d.setDate(monday.getDate() + i + 1);
				return d;
			})
		]);
	}

	/** Returns day label like "Среда, 15 апр" */
	function dayLabelFromWeekIdx(targetWeekId: string, dayIdx: number): string {
		const match = /^(\d{4})-W(\d{2})$/.exec(targetWeekId);
		if (!match) return `день ${dayIdx + 1}`;
		const year = parseInt(match[1]);
		const week = parseInt(match[2]);
		const jan4 = new Date(year, 0, 4);
		const jan4Day = jan4.getDay() === 0 ? 7 : jan4.getDay();
		const monday = new Date(jan4);
		monday.setDate(jan4.getDate() - (jan4Day - 1) + (week - 1) * 7);
		const d = new Date(monday);
		d.setDate(monday.getDate() + dayIdx);
		return `${DAY_FULL[dayIdx]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
	}

	function hasPlansForWeek(personaId: number, wId: string): boolean {
		for (const [key] of localPlans) {
			if (key.startsWith(`${personaId}__${wId}__`)) return true;
		}
		return false;
	}

	function hasPlansForDay(personaId: number, wId: string, dayIdx: number): boolean {
		for (const meal of MEAL_KEYS) {
			const k = slotKey(personaId, wId, dayIdx, meal);
			if ((localPlans.get(k) ?? []).length > 0) return true;
		}
		return false;
	}

	function resolveTargetWeekId(): string {
		if (copyWeekTarget === 'next') return offsetWeekId(weekId, 1);
		const manual = copyWeekManual.trim();
		return /^\d{4}-W\d{2}$/.test(manual) ? manual : '';
	}

	function resolveDayCopyTarget(): { targetWeekId: string; targetDayIdx: number } | null {
		if (copyDayMode === 'tomorrow') {
			if (viewDayIdx < 6) return { targetWeekId: weekId, targetDayIdx: viewDayIdx + 1 };
			return { targetWeekId: offsetWeekId(weekId, 1), targetDayIdx: 0 };
		}
		if (copyDayMode === 'nextweek') {
			return { targetWeekId: offsetWeekId(weekId, 1), targetDayIdx: viewDayIdx };
		}
		// manual
		const tw = copyDayManualWeek.trim();
		if (!/^\d{4}-W\d{2}$/.test(tw)) return null;
		const idx = Math.max(0, Math.min(6, Number(copyDayManualIdx)));
		return { targetWeekId: tw, targetDayIdx: idx };
	}

	async function handleCopyWeekConfirmed(targetWeekId: string) {
		if (!activePersona) return;
		copyingWeek = true;
		showCopyWeekPopover = false;
		copyWeekConfirm = false;
		copyWeekPending = null;
		try {
			const persona = activePersona;
			// gather source rows
			const sourceRows: MenuPlanRow[] = [];
			for (const [key, rows] of localPlans) {
				if (key.startsWith(`${persona.id}__${weekId}__`)) {
					sourceRows.push(...rows);
				}
			}
			if (sourceRows.length === 0) return;

			// snapshot before mutation
			const snapshot = new Map(localPlans);

			// delete existing rows in target week for this persona
			await page.data.supabase
				.from('menu_plans')
				.delete()
				.eq('persona_id', persona.id)
				.eq('week_label', targetWeekId);

			// insert clones
			const inserts = sourceRows.map((r) => ({
				persona_id: persona.id,
				week_label: targetWeekId,
				day_index: r.day_index,
				meal_key: r.meal_key,
				dish_name: r.dish_name,
				dish_photo: r.dish_photo,
				dish_category: r.dish_category,
				kcal: r.kcal,
				protein: r.protein,
				fat: r.fat,
				carbs: r.carbs,
				cost: r.cost,
				grams: r.grams,
				sort_order: r.sort_order
			}));

			const { data: inserted } = await page.data.supabase
				.from('menu_plans')
				.insert(inserts)
				.select('id, day_index, meal_key, dish_name');

			if (!inserted || inserted.length === 0) {
				// restore snapshot on failure
				localPlans = snapshot;
				showErrorToast('Ошибка при копировании. Попробуйте ещё раз.');
				return;
			}

			// add to localPlans
			const next = new Map(localPlans);
			// remove old copies in target week first
			for (const [k] of next) {
				if (k.startsWith(`${persona.id}__${targetWeekId}__`)) next.delete(k);
			}
			// track used indices per (day_index, meal_key, dish_name) to avoid double-matching
			const usedIndices = new Map<string, number>();
			for (const row of inserted) {
				const groupKey = `${row.day_index}__${row.meal_key}__${row.dish_name}`;
				const usedCount = usedIndices.get(groupKey) ?? 0;
				const candidates = sourceRows.filter(
					(r) =>
						r.day_index === row.day_index &&
						r.meal_key === row.meal_key &&
						r.dish_name === row.dish_name
				);
				const src = candidates[usedCount];
				usedIndices.set(groupKey, usedCount + 1);
				if (!src) continue;
				const k = slotKey(persona.id, targetWeekId, row.day_index, row.meal_key as MealKey);
				const arr = next.get(k) ?? [];
				arr.push({ ...src, id: row.id, week_label: targetWeekId });
				next.set(k, arr);
			}
			localPlans = next;
			showToast(
				'Меню скопировано',
				inserted.map((r: { id: number }) => r.id)
			);

			// navigate to target week
			const targetDays = (() => {
				const match = /^(\d{4})-W(\d{2})$/.exec(targetWeekId);
				if (!match) return null;
				const yr = parseInt(match[1]);
				const wk = parseInt(match[2]);
				const jan4 = new Date(yr, 0, 4);
				const jan4Day = jan4.getDay() === 0 ? 7 : jan4.getDay();
				const mon = new Date(jan4);
				mon.setDate(jan4.getDate() - (jan4Day - 1) + (wk - 1) * 7);
				return getWeekDays(0).map((_, i) => {
					const d = new Date(mon);
					d.setDate(mon.getDate() + i);
					return d;
				});
			})();
			if (targetDays) {
				// compute offset from current "real" week
				const currentMon = getWeekDays(0)[0];
				const targetMon = targetDays[0];
				const diffMs = targetMon.getTime() - currentMon.getTime();
				weekOffset = Math.round(diffMs / (7 * 24 * 3600 * 1000));
			}
		} finally {
			copyingWeek = false;
		}
	}

	async function handleCopyWeek() {
		if (!activePersona) return;
		const targetWeekId = resolveTargetWeekId();
		if (!targetWeekId) return;
		if (hasPlansForWeek(activePersona.id, targetWeekId)) {
			copyWeekPending = { targetWeekId };
			copyWeekConfirm = true;
			showCopyWeekPopover = false;
			return;
		}
		await handleCopyWeekConfirmed(targetWeekId);
	}

	function handleCopyFromPersonaClick() {
		if (!activePersona || copyFromPersonaId === null) return;
		const sourcePersona = personas.find((p) => p.id === copyFromPersonaId);
		if (!sourcePersona) return;
		const sourceWeekId = copyFromSourceWeek === 'prev' ? offsetWeekId(weekId, -1) : weekId;
		const sourceRows: MenuPlanRow[] = [];
		for (const [key, rows] of localPlans) {
			if (key.startsWith(`${copyFromPersonaId}__${sourceWeekId}__`)) sourceRows.push(...rows);
		}
		let previewCount = sourceRows.length;
		if (copyFromMergeMode === 'fill') {
			previewCount = sourceRows.filter((r) => {
				const k = slotKey(activePersona.id, weekId, r.day_index, r.meal_key as MealKey);
				return (localPlans.get(k) ?? []).length === 0;
			}).length;
		}
		showCopyWeekPopover = false;
		copyFromPending = {
			sourcePersonaId: copyFromPersonaId,
			sourcePersonaName: sourcePersona.name,
			sourceWeekId,
			mergeMode: copyFromMergeMode,
			previewCount
		};
		copyFromConfirm = true;
	}

	async function handleCopyFromPersonaConfirmed() {
		if (!activePersona || !copyFromPending) return;
		const { sourcePersonaId, sourceWeekId, mergeMode } = copyFromPending;
		copyingWeek = true;
		copyFromConfirm = false;
		const pending = copyFromPending;
		copyFromPending = null;
		try {
			const persona = activePersona;
			const sourceRows: MenuPlanRow[] = [];
			for (const [key, rows] of localPlans) {
				if (key.startsWith(`${sourcePersonaId}__${sourceWeekId}__`)) sourceRows.push(...rows);
			}
			if (sourceRows.length === 0) return;
			const snapshot = new Map(localPlans);

			const rowsToInsert =
				mergeMode === 'fill'
					? sourceRows.filter((r) => {
							const k = slotKey(persona.id, weekId, r.day_index, r.meal_key as MealKey);
							return (localPlans.get(k) ?? []).length === 0;
						})
					: sourceRows;

			if (rowsToInsert.length === 0) return;

			if (mergeMode === 'replace') {
				await page.data.supabase
					.from('menu_plans')
					.delete()
					.eq('persona_id', persona.id)
					.eq('week_label', weekId);
			}

			const inserts = rowsToInsert.map((r) => ({
				persona_id: persona.id,
				week_label: weekId,
				day_index: r.day_index,
				meal_key: r.meal_key,
				dish_name: r.dish_name,
				dish_photo: r.dish_photo,
				dish_category: r.dish_category,
				kcal: r.kcal,
				protein: r.protein,
				fat: r.fat,
				carbs: r.carbs,
				cost: r.cost,
				grams: r.grams,
				sort_order: r.sort_order
			}));

			const { data: inserted } = await page.data.supabase
				.from('menu_plans')
				.insert(inserts)
				.select('id, day_index, meal_key, dish_name');

			if (!inserted || inserted.length === 0) {
				localPlans = snapshot;
				showErrorToast('Ошибка при копировании. Попробуйте ещё раз.');
				return;
			}

			const next = new Map(localPlans);
			if (mergeMode === 'replace') {
				for (const [k] of next) {
					if (k.startsWith(`${persona.id}__${weekId}__`)) next.delete(k);
				}
			}
			const usedIndices = new Map<string, number>();
			for (const row of inserted) {
				const groupKey = `${row.day_index}__${row.meal_key}__${row.dish_name}`;
				const usedCount = usedIndices.get(groupKey) ?? 0;
				const candidates = rowsToInsert.filter(
					(r) =>
						r.day_index === row.day_index &&
						r.meal_key === row.meal_key &&
						r.dish_name === row.dish_name
				);
				const src = candidates[usedCount];
				usedIndices.set(groupKey, usedCount + 1);
				if (!src) continue;
				const k = slotKey(persona.id, weekId, row.day_index, row.meal_key as MealKey);
				const arr = next.get(k) ?? [];
				arr.push({ ...src, id: row.id, week_label: weekId, persona_id: persona.id });
				next.set(k, arr);
			}
			localPlans = next;
			const srcName = pending.sourcePersonaName;
			const modeLabel = mergeMode === 'fill' ? 'дополнено' : 'скопировано';
			showToast(
				`Меню ${modeLabel} из «${srcName}»`,
				inserted.map((r: { id: number }) => r.id)
			);
		} finally {
			copyingWeek = false;
		}
	}

	async function handleCopyDayConfirmed(targetWeekId: string, targetDayIdx: number) {
		if (!activePersona) return;
		copyingDay = true;
		showCopyDayPopover = false;
		copyDayConfirm = false;
		copyDayPending = null;
		try {
			const persona = activePersona;
			const sourceRows: MenuPlanRow[] = [];
			for (const meal of MEAL_KEYS) {
				const k = slotKey(persona.id, weekId, viewDayIdx, meal);
				sourceRows.push(...(localPlans.get(k) ?? []));
			}
			if (sourceRows.length === 0) return;

			// snapshot before mutation
			const snapshot = new Map(localPlans);

			// delete existing in target day
			for (const meal of MEAL_KEYS) {
				const existingRows =
					localPlans.get(slotKey(persona.id, targetWeekId, targetDayIdx, meal)) ?? [];
				if (existingRows.length > 0) {
					await page.data.supabase
						.from('menu_plans')
						.delete()
						.eq('persona_id', persona.id)
						.eq('week_label', targetWeekId)
						.eq('day_index', targetDayIdx)
						.eq('meal_key', meal);
				}
			}

			const inserts = sourceRows.map((r) => ({
				persona_id: persona.id,
				week_label: targetWeekId,
				day_index: targetDayIdx,
				meal_key: r.meal_key,
				dish_name: r.dish_name,
				dish_photo: r.dish_photo,
				dish_category: r.dish_category,
				kcal: r.kcal,
				protein: r.protein,
				fat: r.fat,
				carbs: r.carbs,
				cost: r.cost,
				grams: r.grams,
				sort_order: r.sort_order
			}));

			const { data: inserted } = await page.data.supabase
				.from('menu_plans')
				.insert(inserts)
				.select('id, day_index, meal_key, dish_name');

			if (!inserted || inserted.length === 0) {
				// restore snapshot on failure
				localPlans = snapshot;
				showErrorToast('Ошибка при копировании. Попробуйте ещё раз.');
				return;
			}

			const next = new Map(localPlans);
			// remove stale target day entries
			for (const meal of MEAL_KEYS) {
				next.delete(slotKey(persona.id, targetWeekId, targetDayIdx, meal));
			}
			// track used indices per (meal_key, dish_name) to avoid double-matching
			const usedIndices = new Map<string, number>();
			for (const row of inserted) {
				const groupKey = `${row.meal_key}__${row.dish_name}`;
				const usedCount = usedIndices.get(groupKey) ?? 0;
				const candidates = sourceRows.filter(
					(r) => r.meal_key === row.meal_key && r.dish_name === row.dish_name
				);
				const src = candidates[usedCount];
				usedIndices.set(groupKey, usedCount + 1);
				if (!src) continue;
				const k = slotKey(persona.id, targetWeekId, row.day_index, row.meal_key as MealKey);
				const arr = next.get(k) ?? [];
				arr.push({ ...src, id: row.id, week_label: targetWeekId, day_index: targetDayIdx });
				next.set(k, arr);
			}
			localPlans = next;
			showToast(
				'День скопирован',
				inserted.map((r: { id: number }) => r.id)
			);
		} finally {
			copyingDay = false;
		}
	}

	async function handleCopyDay() {
		if (!activePersona) return;
		const target = resolveDayCopyTarget();
		if (!target) return;
		const { targetWeekId, targetDayIdx } = target;
		if (hasPlansForDay(activePersona.id, targetWeekId, targetDayIdx)) {
			copyDayPending = { targetWeekId, targetDayIdx };
			copyDayConfirm = true;
			showCopyDayPopover = false;
			return;
		}
		await handleCopyDayConfirmed(targetWeekId, targetDayIdx);
	}

	// ── Автогенерация ─────────────────────────────────────────────────────
	let showGenConfirm = $state(false);
	let generating = $state(false);

	function hasPlansThisWeek(): boolean {
		if (!activePersona) return false;
		for (const [key] of localPlans) {
			if (key.startsWith(`${activePersona.id}__${weekId}__`)) return true;
		}
		return false;
	}

	async function handleGenerate() {
		if (!activePersona) return;
		if (hasPlansThisWeek()) {
			showGenConfirm = true;
			return;
		}
		await runGenerate();
	}

	function handleFridgeGenerate(selected: FridgeRow[]) {
		fridgeModalOpen = false;
		splitDropOpen   = false;

		const allDishes: Dish[] = [
			...((page.data.foodCatalog ?? []) as Dish[]),
			...((page.data.customDishes ?? []) as import('$lib/types/database.js').CustomDish[])
				.map((cd, i) => customToDish(cd, i)),
		];

		const hints = buildFridgeHints(selected, allDishes);
		runGenerate(hints);
	}

	async function runGenerate(fridgeHints?: FridgeHint[]) {
		// Закрываем диалог и ждём обновления DOM до любых тяжёлых операций
		showGenConfirm = false;
		await tick();

		const persona = activePersona;
		if (!persona) return;

		generating = true;
		try {
			const slots = generateWeekPlan({
				kcal_target: persona.kcal_target ?? 2000,
				meal_ratios: persona.meal_ratios as { bf: number; ln: number; dn: number },
				carry_dinner_to_lunch: (page.data.household as import('$lib/types/database.js').Household | null)?.carry_dinner_to_lunch ?? true,
				match_kcal: persona.match_kcal ?? true,
				customDishes: (page.data.customDishes ??
					[]) as import('$lib/types/database.js').CustomDish[],
				foodCatalog: (page.data.foodCatalog ?? []) as Dish[],
				fridgeHints,
			});

			// Оптимистично: группируем по ключу слота
			// sort_order = глобальный индекс (совпадает с DB rows), id = уникальный отрицательный
			const next = new Map<string, MenuPlanRow[]>();
			slots.forEach((s, slotIdx) => {
				const key = slotKey(persona.id, weekId, s.day_index, s.meal_key);
				const arr = next.get(key) ?? [];
				arr.push({
					id: -(slotIdx + 1), // уникальный: -1, -2, -3, ...
					persona_id: persona.id,
					week_label: weekId,
					day_index: s.day_index,
					meal_key: s.meal_key,
					dish_name: s.dish.name,
					dish_photo: s.dish.photo ?? null,
					dish_category: s.dish_category,
					kcal: s.kcal,
					protein: s.protein,
					fat: s.fat,
					carbs: s.carbs,
					cost: s.cost,
					grams: s.grams,
					sort_order: slotIdx // глобальный индекс = как в DB rows
				});
				next.set(key, arr);
			});
			// Сохраняем планы других недель
			for (const [k, v] of localPlans) {
				if (!k.includes(`__${weekId}__`)) next.set(k, v);
			}
			localPlans = next;

			// Удаляем старые планы, вставляем новые
			const supabase = page.data.supabase;
			await supabase
				.from('menu_plans')
				.delete()
				.eq('persona_id', persona.id)
				.eq('week_label', weekId);

			const rows = slots.map((s, idx) => ({
				persona_id: persona.id,
				week_label: weekId,
				day_index: s.day_index,
				meal_key: s.meal_key,
				dish_name: s.dish.name,
				dish_photo: s.dish.photo ?? null,
				dish_category: s.dish_category,
				kcal: s.kcal,
				protein: s.protein,
				fat: s.fat,
				carbs: s.carbs,
				cost: s.cost,
				grams: s.grams,
				sort_order: idx
			}));

			const { data: inserted } = await supabase
				.from('menu_plans')
				.insert(rows)
				.select('id, day_index, meal_key, sort_order');

			// Обновляем реальные id по sort_order
			if (inserted) {
				const updated = new Map(localPlans);
				for (const row of inserted) {
					const key = slotKey(persona.id, weekId, row.day_index, row.meal_key as MealKey);
					const arr = updated.get(key);
					if (arr) {
						const idx = arr.findIndex((r) => r.sort_order === row.sort_order && r.id < 0);
						if (idx !== -1) arr[idx] = { ...arr[idx], id: row.id };
						updated.set(key, [...arr]);
					}
				}
				localPlans = updated;
			}
		} finally {
			generating = false;
		}
	}

	// ── SVG-иконки приёмов пищи ───────────────────────────────────────────
	function mealIconPath(meal: string): string {
		const paths: Record<string, string> = {
			bf: '<circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M10.5 10.5l1.1 1.1M12.6 3.4l-1.1 1.1M5.5 10.5l-1.1 1.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
			ln: '<path d="M5 1.5v4a2.5 2.5 0 0 0 5 0v-4M7.5 5.5v8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.5 1.5v3c0 1.5 1 2.5 1 4a2 2 0 0 1-4 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
			dn: '<path d="M13 10a6 6 0 1 1-7-8.9A5 5 0 0 0 13 10z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
			sn: '<path d="M8 4C6 4 4 6 4 9s2 5 4 5 4-2 4-5-2-5-4-5z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="M8 4V2.5M10 3c.5-1.5 2-2 3-1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
		};
		return paths[meal] ?? '';
	}

	function mealAccentColor(meal: string): string {
		const colors: Record<string, string> = {
			bf: 'var(--color-warning)',
			ln: 'var(--color-meal-lunch)',
			dn: 'var(--color-meal-dinner)',
			sn: 'var(--color-green-primary)'
		};
		return colors[meal] ?? 'var(--color-border)';
	}
</script>

<svelte:head><title>MealPlaniX — Планировщик меню</title></svelte:head>

<div class="flex min-h-screen flex-col" style="background: var(--color-bg-page);">
	<!-- ── Переключатель персон ────────────────────────────────────────── -->
	{#if personas.length > 0}
		<div
			class="flex items-center gap-0 overflow-x-auto px-4"
			style="height: 56px; border-bottom: 1px solid var(--color-border); background: var(--color-bg-card); scrollbar-width: none;"
		>
			{#each personas as p}
				<button
					onclick={() => {
						activeId = p.id;
					}}
					class="flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all"
					style="
            border: none;
            background: transparent;
            color: {activeId === p.id ? 'var(--color-green-primary)' : 'var(--color-text-muted)'};
            border-bottom: 2px solid {activeId === p.id
						? 'var(--color-green-primary)'
						: 'transparent'};
          "
				>
					<span
						class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
						style="background: {activeId === p.id
							? 'var(--color-green-primary)'
							: 'var(--color-border)'}; color: {activeId === p.id
							? 'var(--color-text-inverse)'
							: 'var(--color-text-muted)'};"
					>
						{initials(p.name)}
					</span>
					{p.name}
					{#if p.user_id === null}
						<span
							class="rounded px-1.5 py-0.5 text-xs font-normal"
							style="background: var(--color-bg-page); color: var(--color-text-muted); border: 1px solid var(--color-border); opacity: 0.85;"
							>без акк.</span
						>
					{:else if p.kcal_target}
						<span class="text-xs font-normal" style="opacity: 0.55;">{p.kcal_target} ккал</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	<!-- ── Навигация ────────────────────────────────────────────────────── -->
	<div
		class="flex items-center justify-between gap-3 px-4"
		style="height: 56px; background: var(--color-bg-card); border-bottom: 1px solid var(--color-border);"
	>
		<!-- Лево: переключатель вид + стрелка + метка + стрелка -->
		<div class="flex min-w-0 flex-1 items-center gap-2">
			<!-- Сегментный переключатель -->
			<div
				class="flex shrink-0 overflow-hidden rounded-lg"
				style="background: var(--color-bg-page); border: 1px solid var(--color-border);"
			>
				<button
					type="button"
					onclick={() => switchView('week')}
					class="px-3 py-1.5 text-xs font-semibold transition-all"
					style="
            background: {viewMode === 'week' ? 'var(--color-green-primary)' : 'transparent'};
            color:      {viewMode === 'week'
						? 'var(--color-text-inverse)'
						: 'var(--color-text-muted)'};
          ">Неделя</button
				>
				<button
					type="button"
					onclick={() => switchView('day')}
					class="px-3 py-1.5 text-xs font-semibold transition-all"
					style="
            background: {viewMode === 'day' ? 'var(--color-green-primary)' : 'transparent'};
            color:      {viewMode === 'day'
						? 'var(--color-text-inverse)'
						: 'var(--color-text-muted)'};
          ">День</button
				>
			</div>

			<button
				onclick={prevPeriod}
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
				style="background: var(--color-bg-page); color: var(--color-text-muted);"
				onmouseenter={(e) => {
					(e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
				}}
				onmouseleave={(e) => {
					(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
				}}
				aria-label="Назад"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
					><path
						d="M10 3L5 8l5 5"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/></svg
				>
			</button>

			<div class="min-w-0">
				{#if viewMode === 'week'}
					<p
						class="truncate text-sm leading-tight font-semibold"
						style="color: var(--color-text-primary);"
					>
						{weekLabel}
					</p>
					<p class="text-xs leading-tight" style="color: var(--color-text-muted);">
						{#if weekOffset === 0}Текущая неделя
						{:else if weekOffset === 1}Следующая неделя
						{:else if weekOffset === -1}Прошлая неделя
						{:else}{weekOffset > 0 ? '+' : ''}{weekOffset} нед.
						{/if}
					</p>
				{:else}
					<p class="text-sm leading-tight font-semibold" style="color: var(--color-text-primary);">
						{dayNavLabel(viewDay)}
					</p>
					<p class="text-xs leading-tight" style="color: var(--color-green-primary);">
						{#if isToday(viewDay)}Сегодня{:else}&nbsp;{/if}
					</p>
				{/if}
			</div>

			<button
				onclick={nextPeriod}
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
				style="background: var(--color-bg-page); color: var(--color-text-muted);"
				onmouseenter={(e) => {
					(e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
				}}
				onmouseleave={(e) => {
					(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
				}}
				aria-label="Вперёд"
			>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
					><path
						d="M6 3l5 5-5 5"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					/></svg
				>
			</button>
		</div>

		<!-- Право: кнопка копирования + кнопка генерации -->
		<div class="flex shrink-0 items-center gap-2">

			<!-- Кнопка «Копировать неделю» + поповер -->
			{#if viewMode === 'week' && canEdit}
				<div class="relative">
					<button
						type="button"
						onclick={() => {
							showCopyWeekPopover = !showCopyWeekPopover;
							copyWeekTarget = 'next';
							copyWeekManual = '';
							copyWeekTab = 'toWeek';
							copyFromPersonaId = personas.find((p) => p.id !== activePersona?.id)?.id ?? null;
							copyFromSourceWeek = 'current';
							copyFromMergeMode = 'replace';
						}}
						disabled={copyingWeek || !activePersona}
						class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
						style="
              background: var(--color-bg-page);
              border: 1px solid var(--color-border);
              color: var(--color-text-muted);
              opacity: {copyingWeek ? '0.6' : '1'};
            "
						onmouseenter={(e) => {
							if (!copyingWeek) {
								(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-green-soft)';
								(e.currentTarget as HTMLElement).style.color = 'var(--color-green-primary)';
							}
						}}
						onmouseleave={(e) => {
							(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
							(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
						}}
						aria-label="Копировать неделю"
					>
						{#if copyingWeek}
							<span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
						{:else}
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
								<rect x="1" y="3" width="7" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
								<path d="M4 3V2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
							</svg>
						{/if}
						Копировать
					</button>

					{#if showCopyWeekPopover}
						<!-- backdrop -->
						<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
						<div class="fixed inset-0 z-40" onclick={() => (showCopyWeekPopover = false)}></div>
						<div
							class="absolute top-full right-0 z-50 mt-1.5 rounded-xl shadow-lg"
							style="width: 272px; background: var(--color-bg-card); border: 1px solid var(--color-border); box-shadow: var(--shadow-modal); overflow: hidden;"
						>
							<!-- Табы -->
							<div class="flex" style="border-bottom: 1px solid var(--color-border);">
								<button
									type="button"
									onclick={() => (copyWeekTab = 'toWeek')}
									class="flex-1 py-2.5 text-xs font-semibold transition-colors"
									style="background: {copyWeekTab === 'toWeek' ? 'var(--color-bg-card)' : 'var(--color-bg-page)'}; border: none; border-right: 1px solid var(--color-border); cursor: pointer; color: {copyWeekTab === 'toWeek' ? 'var(--color-green-primary)' : 'var(--color-text-muted)'};"
								>На другую неделю</button>
								<button
									type="button"
									onclick={() => (copyWeekTab = 'fromPersona')}
									class="flex-1 py-2.5 text-xs font-semibold transition-colors"
									style="background: {copyWeekTab === 'fromPersona' ? 'var(--color-bg-card)' : 'var(--color-bg-page)'}; border: none; cursor: pointer; color: {copyWeekTab === 'fromPersona' ? 'var(--color-green-primary)' : 'var(--color-text-muted)'};"
								>Из другой персоны</button>
							</div>

							<div class="p-4">
								{#if copyWeekTab === 'toWeek'}
									<!-- ── Вкладка: скопировать НА другую неделю ── -->
									<p class="mb-3 text-xs font-semibold" style="color: var(--color-text-primary);">Скопировать на:</p>
									<label class="mb-2 flex cursor-pointer items-center gap-2 text-xs" style="color: var(--color-text-primary);">
										<input type="radio" bind:group={copyWeekTarget} value="next" class="accent-green-700"/>
										Следующая неделя
										<span class="ml-auto font-mono text-xs" style="color: var(--color-text-muted);">{offsetWeekId(weekId, 1)}</span>
									</label>
									<label class="mb-3 flex cursor-pointer items-center gap-2 text-xs" style="color: var(--color-text-primary);">
										<input type="radio" bind:group={copyWeekTarget} value="manual" class="accent-green-700"/>
										Ввести вручную
									</label>
									{#if copyWeekTarget === 'manual'}
										<input
											type="text"
											bind:value={copyWeekManual}
											placeholder="2026-W16"
											class="mb-3 w-full rounded-lg px-3 py-1.5 text-xs"
											style="border: 1px solid var(--color-border); background: var(--color-bg-input); color: var(--color-text-primary); outline: none;"
										/>
									{/if}
									<button
										type="button"
										onclick={handleCopyWeek}
										disabled={copyWeekTarget === 'manual' && !/^\d{4}-W\d{2}$/.test(copyWeekManual.trim())}
										class="w-full rounded-lg py-1.5 text-xs font-semibold"
										style="background: var(--color-green-dark); color: var(--color-text-inverse); opacity: {copyWeekTarget === 'manual' && !/^\d{4}-W\d{2}$/.test(copyWeekManual.trim()) ? '0.5' : '1'};"
									>Скопировать</button>

								{:else}
									<!-- ── Вкладка: скопировать ИЗ другой персоны ── -->
									{@const otherPersonas = personas.filter((p) => p.id !== activePersona?.id)}
									{#if otherPersonas.length === 0}
										<p class="py-4 text-center text-xs" style="color: var(--color-text-muted);">Нет других персон в домохозяйстве</p>
									{:else}
										<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-primary);">Персона-источник:</p>
										<div class="mb-3 flex flex-col gap-1">
											{#each otherPersonas as p}
												{@const srcWeekId = copyFromSourceWeek === 'prev' ? offsetWeekId(weekId, -1) : weekId}
												{@const srcCount = (() => { let n = 0; for (const [k, rows] of localPlans) { if (k.startsWith(`${p.id}__${srcWeekId}__`)) n += rows.length; } return n; })()}
												<label
													class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors"
													style="background: {copyFromPersonaId === p.id ? 'var(--color-green-tint)' : 'var(--color-bg-page)'}; border: 1px solid {copyFromPersonaId === p.id ? 'var(--color-green-tint-border)' : 'var(--color-border)'}; color: var(--color-text-primary); opacity: {srcCount === 0 ? '0.45' : '1'};"
												>
													<input type="radio" bind:group={copyFromPersonaId} value={p.id} disabled={srcCount === 0} class="accent-green-700"/>
													<span class="flex-1 font-semibold">{p.name}</span>
													<span style="color: var(--color-text-muted);">
														{srcCount > 0 ? `${srcCount} блюд` : 'нет меню'}
													</span>
												</label>
											{/each}
										</div>

										<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-primary);">Неделя источника:</p>
										<div class="mb-3 flex flex-col gap-1">
											<label class="flex cursor-pointer items-center gap-2 text-xs" style="color: var(--color-text-primary);">
												<input type="radio" bind:group={copyFromSourceWeek} value="current" class="accent-green-700"/>
												Текущая
												<span class="ml-auto font-mono text-xs" style="color: var(--color-text-muted);">{weekId}</span>
											</label>
											<label class="flex cursor-pointer items-center gap-2 text-xs" style="color: var(--color-text-primary);">
												<input type="radio" bind:group={copyFromSourceWeek} value="prev" class="accent-green-700"/>
												Предыдущая
												<span class="ml-auto font-mono text-xs" style="color: var(--color-text-muted);">{offsetWeekId(weekId, -1)}</span>
											</label>
										</div>

										<p class="mb-2 text-xs font-semibold" style="color: var(--color-text-primary);">Режим вставки:</p>
										<div class="mb-4 flex flex-col gap-1">
											<label class="flex cursor-pointer items-center gap-2 text-xs" style="color: var(--color-text-primary);">
												<input type="radio" bind:group={copyFromMergeMode} value="replace" class="accent-green-700"/>
												<span>
													<strong>Заменить</strong> — перезаписать текущее меню
												</span>
											</label>
											<label class="flex cursor-pointer items-center gap-2 text-xs" style="color: var(--color-text-primary);">
												<input type="radio" bind:group={copyFromMergeMode} value="fill" class="accent-green-700"/>
												<span>
													<strong>Дополнить</strong> — только пустые слоты
												</span>
											</label>
										</div>

										<button
											type="button"
											onclick={handleCopyFromPersonaClick}
											disabled={copyFromPersonaId === null}
											class="w-full rounded-lg py-1.5 text-xs font-semibold"
											style="background: var(--color-green-dark); color: var(--color-text-inverse); opacity: {copyFromPersonaId === null ? '0.45' : '1'};"
										>Скопировать</button>
									{/if}
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Кнопка «Копировать день» (day mode) -->
			{#if viewMode === 'day' && canEdit}
				<div class="relative">
					<button
						type="button"
						onclick={() => {
							showCopyDayPopover = !showCopyDayPopover;
							copyDayMode = 'tomorrow';
							copyDayManualWeek = '';
							copyDayManualIdx = viewDayIdx;
						}}
						disabled={copyingDay || !activePersona}
						class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
						style="
              background: var(--color-bg-page);
              border: 1px solid var(--color-border);
              color: var(--color-text-muted);
              opacity: {copyingDay ? '0.6' : '1'};
            "
						onmouseenter={(e) => {
							if (!copyingDay) {
								(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-green-soft)';
								(e.currentTarget as HTMLElement).style.color = 'var(--color-green-primary)';
							}
						}}
						onmouseleave={(e) => {
							(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
							(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
						}}
						aria-label="Копировать день"
					>
						{#if copyingDay}
							<span
								class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
							></span>
						{:else}
							<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
								<rect
									x="1"
									y="3"
									width="7"
									height="8"
									rx="1.5"
									stroke="currentColor"
									stroke-width="1.4"
								/>
								<path
									d="M4 3V2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9"
									stroke="currentColor"
									stroke-width="1.4"
									stroke-linecap="round"
								/>
							</svg>
						{/if}
						Копировать день
					</button>

					{#if showCopyDayPopover}
						<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
						<div class="fixed inset-0 z-40" onclick={() => (showCopyDayPopover = false)}></div>
						<div
							class="absolute top-full right-0 z-50 mt-1.5 rounded-xl p-4 shadow-lg"
							style="width: 260px; background: var(--color-bg-card); border: 1px solid var(--color-border); box-shadow: var(--shadow-modal);"
						>
							<p class="mb-3 text-xs font-semibold" style="color: var(--color-text-primary);">
								Скопировать на:
							</p>
							<label
								class="mb-2 flex cursor-pointer items-center gap-2 text-xs"
								style="color: var(--color-text-primary);"
							>
								<input
									type="radio"
									bind:group={copyDayMode}
									value="tomorrow"
									class="accent-green-700"
								/>
								Завтра
							</label>
							<label
								class="mb-2 flex cursor-pointer items-center gap-2 text-xs"
								style="color: var(--color-text-primary);"
							>
								<input
									type="radio"
									bind:group={copyDayMode}
									value="nextweek"
									class="accent-green-700"
								/>
								Следующая неделя, тот же день
							</label>
							<label
								class="mb-3 flex cursor-pointer items-center gap-2 text-xs"
								style="color: var(--color-text-primary);"
							>
								<input
									type="radio"
									bind:group={copyDayMode}
									value="manual"
									class="accent-green-700"
								/>
								Ввести вручную
							</label>
							{#if copyDayMode === 'manual'}
								<div class="mb-3 flex flex-col gap-2">
									<input
										type="text"
										bind:value={copyDayManualWeek}
										placeholder="Неделя: 2026-W16"
										class="w-full rounded-lg px-3 py-1.5 text-xs"
										style="border: 1px solid var(--color-border); background: var(--color-bg-input); color: var(--color-text-primary); outline: none;"
									/>
									<select
										bind:value={copyDayManualIdx}
										class="w-full rounded-lg px-3 py-1.5 text-xs"
										style="border: 1px solid var(--color-border); background: var(--color-bg-input); color: var(--color-text-primary); outline: none;"
									>
										{#each DAY_FULL as label, i}
											<option value={i}>{label}</option>
										{/each}
									</select>
								</div>
							{/if}
							<button
								type="button"
								onclick={handleCopyDay}
								disabled={copyDayMode === 'manual' &&
									!/^\d{4}-W\d{2}$/.test(copyDayManualWeek.trim())}
								class="w-full rounded-lg py-1.5 text-xs font-semibold transition-colors"
								style="background: var(--color-green-dark); color: var(--color-text-inverse); opacity: {copyDayMode ===
									'manual' && !/^\d{4}-W\d{2}$/.test(copyDayManualWeek.trim())
									? '0.5'
									: '1'};">Скопировать</button
							>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Кнопка генерации (split) -->
			{#if canEdit}
			<div class="relative flex" style="gap: 2px;">
				<!-- Основная кнопка — обычная генерация -->
				<button
					onclick={handleGenerate}
					disabled={generating || !activePersona}
					class="flex items-center gap-1.5 rounded-lg rounded-r-none px-3 py-1.5 text-xs font-semibold transition-all"
					style="background: var(--color-green-dark); color: var(--color-text-inverse); letter-spacing: 0.02em; opacity: {generating ? '0.6' : '1'};"
					onmouseenter={(e) => { if (!generating) (e.currentTarget as HTMLElement).style.background = 'var(--color-green-primary)'; }}
					onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-green-dark)'; }}
					aria-label="Сгенерировать меню"
				>
					{#if generating}
						<span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
						Генерирую...
					{:else}
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.93 2.93l1.41 1.41M7.66 7.66l1.41 1.41M2.93 9.07l1.41-1.41M7.66 4.34l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
						Сгенерировать
					{/if}
				</button>

				<!-- Стрелка-дропдаун -->
				<button
					onclick={() => (splitDropOpen = !splitDropOpen)}
					disabled={generating || !activePersona}
					class="flex items-center px-2 py-1.5 rounded-lg rounded-l-none text-xs font-semibold transition-all"
					style="background: var(--color-green-dark); color: var(--color-text-inverse); opacity: {generating ? '0.6' : '1'}; border-left: 1px solid color-mix(in srgb, white 20%, transparent);"
					aria-label="Дополнительные варианты генерации"
				>
					<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
				</button>

				<!-- Дропдаун-меню -->
				{#if splitDropOpen}
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<div
						class="fixed inset-0"
						style="z-index: 10;"
						onclick={() => (splitDropOpen = false)}
					></div>
					<div
						class="absolute top-full mt-1 right-0 rounded-lg overflow-hidden"
						style="background: var(--color-bg-card); border: 1px solid var(--color-border); box-shadow: var(--shadow-modal); z-index: 20; min-width: 200px;"
					>
						<button
							onclick={() => { splitDropOpen = false; handleGenerate(); }}
							class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors"
							style="color: var(--color-text-primary);"
							onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'}
							onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
						>
							🎲 Сгенерировать случайно
						</button>
						<button
							onclick={() => { splitDropOpen = false; if (hasFridge) fridgeModalOpen = true; }}
							disabled={!hasFridge}
							class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors"
							style="color: {hasFridge ? 'var(--color-green-dark)' : 'var(--color-text-muted)'}; opacity: {hasFridge ? '1' : '0.5'};"
							onmouseenter={(e) => { if (hasFridge) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'; }}
							onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
						>
							🧊 С учётом холодильника…
						</button>
					</div>
				{/if}
			</div>
			{/if}
		</div>
	</div>

	<!-- ── WeekGrid ─────────────────────────────────────────────────────── -->
	{#if viewMode === 'week'}
		<div class="flex flex-1 flex-col gap-2.5 px-3 pt-3 pb-8">
			{#each weekDays as day, dayIdx}
				{@const today = isToday(day)}

				<!-- Суммарные ккал за день -->
				{@const dayKcal = activePersona
					? MEAL_KEYS.reduce((sum, meal) => {
							const plans = localPlans.get(slotKey(activePersona.id, weekId, dayIdx, meal)) ?? [];
							return sum + plans.reduce((s, p) => s + p.kcal, 0);
						}, 0)
					: 0}

				<!-- Карточка дня -->
				<div
					style="
          background: var(--color-bg-card);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-card);
          border: 1px solid var(--color-border);
          overflow: hidden;
        "
				>
					<!-- Заголовок дня -->
					<div
						class="flex items-center justify-between px-4 py-2.5"
						style="border-bottom: 1px solid var(--color-border);"
					>
						<div class="flex items-center gap-2.5">
							{#if today}
								<span
									class="h-2 w-2 shrink-0 rounded-full"
									style="background: var(--color-green-primary);"
								></span>
							{/if}
							<span
								class="text-sm font-semibold"
								style="color: {today
									? 'var(--color-green-primary)'
									: 'var(--color-text-primary)'}; letter-spacing: -0.01em;"
							>
								{DAY_FULL[dayIdx]}, {day.getDate()}
								{MONTH_SHORT[day.getMonth()]}
							</span>
							{#if today}
								<span
									class="rounded px-1.5 py-0.5 text-xs font-medium"
									style="background: var(--color-green-primary); color: var(--color-text-inverse); letter-spacing: 0.02em;"
								>
									сегодня
								</span>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							{#if dayKcal > 0}
								<span
									class="text-xs font-medium tabular-nums"
									style="color: var(--color-text-muted);"
								>
									{dayKcal} ккал
								</span>
							{/if}
							{#if activePersona?.kcal_target && dayKcal > 0}
								{@const target = activePersona.kcal_target}
								{@const overPct = Math.round(((dayKcal - target) / target) * 100)}
								{#if overPct > 5}
									<span class="text-xs font-medium" style="color: var(--color-error);">
										+{overPct}%
									</span>
								{:else if target - dayKcal > target * 0.1}
									<span class="text-xs font-medium" style="color: var(--color-warning);">
										−{target - dayKcal}
									</span>
								{/if}
							{/if}
						</div>
					</div>

					<!-- Прогресс-бар ккал дня -->
					{#if activePersona?.kcal_target && dayKcal > 0}
						<div style="height: 3px; overflow: hidden; background: var(--color-border);">
							<div
								style="height: 100%; transition: width 0.3s; width: {Math.min(
									100,
									Math.round((dayKcal / activePersona.kcal_target) * 100)
								)}%; background: {dayKcal > activePersona.kcal_target * 1.05
									? 'var(--color-error)'
									: dayKcal >= activePersona.kcal_target * 0.9
										? 'var(--color-green-primary)'
										: 'var(--color-warning)'};"
							></div>
						</div>
					{/if}

					<!-- 4 колонки приёмов -->
					<div
						class="grid gap-px"
						style="grid-template-columns: repeat(4, 1fr); background: var(--color-border);"
					>
						{#each MEAL_KEYS as meal}
							{@const key = activePersona ? slotKey(activePersona.id, weekId, dayIdx, meal) : ''}
							{@const plans = activePersona ? (localPlans.get(key) ?? []) : []}
							{@const slotKcal = plans.reduce((s, p) => s + p.kcal, 0)}

							<div class="flex flex-col" style="background: var(--color-bg-card);">
								<!-- Лейбл приёма + ккал слота -->
								<div class="flex items-baseline justify-between px-3 pt-2 pb-1">
									<span
										style="font-size: 10px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.07em;"
									>
										{MEAL_LABELS[meal]}
									</span>
									{#if slotKcal > 0}
										<span
											style="font-size: 10px; color: var(--color-text-muted); font-variant-numeric: tabular-nums;"
											>{slotKcal}</span
										>
									{/if}
								</div>

								<!-- Список блюд + кнопка добавить -->
								<div class="flex flex-col gap-1.5 px-2 pb-2">
									{#each plans as plan (plan.id)}
										<MealCard
											name={plan.dish_name}
											kcal={plan.kcal}
											protein={plan.protein}
											fat={plan.fat}
											carbs={plan.carbs}
											cost={plan.cost ?? 0}
											grams={plan.grams || undefined}
											photo={plan.dish_photo ?? undefined}
											onremove={() => { if (canEdit) handleRemove(plan); }}
											onclick={() => openDetail(plan)}
										/>
									{/each}

									<!-- Кнопка + добавить -->
									{#if canEdit}
									<button
										onclick={() => openModal(dayIdx, meal)}
										class="w-full cursor-pointer text-left transition-all"
										style="
                    padding: 5px 8px;
                    background: transparent;
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-sm);
                    font-size: 11px;
                    color: var(--color-text-muted);
                  "
										onmouseenter={(e) => {
											const el = e.currentTarget as HTMLElement;
											el.style.borderColor = 'var(--color-green-soft)';
											el.style.color = 'var(--color-green-primary)';
										}}
										onmouseleave={(e) => {
											const el = e.currentTarget as HTMLElement;
											el.style.borderColor = 'var(--color-border)';
											el.style.color = 'var(--color-text-muted)';
										}}
										aria-label="Добавить блюдо: {DAY_FULL[dayIdx]}, {MEAL_LABELS[meal]}"
									>
										+ блюдо
									</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- ── Day View ──────────────────────────────────────────────────────── -->
	{#if viewMode === 'day' && activePersona}
		{@const totalKcal = MEAL_KEYS.reduce(
			(s, m) =>
				s +
				(localPlans.get(slotKey(activePersona.id, weekId, viewDayIdx, m)) ?? []).reduce(
					(a, p) => a + p.kcal,
					0
				),
			0
		)}
		{@const totalProtein = MEAL_KEYS.reduce(
			(s, m) =>
				s +
				(localPlans.get(slotKey(activePersona.id, weekId, viewDayIdx, m)) ?? []).reduce(
					(a, p) => a + p.protein,
					0
				),
			0
		)}
		{@const totalFat = MEAL_KEYS.reduce(
			(s, m) =>
				s +
				(localPlans.get(slotKey(activePersona.id, weekId, viewDayIdx, m)) ?? []).reduce(
					(a, p) => a + p.fat,
					0
				),
			0
		)}
		{@const totalCarbs = MEAL_KEYS.reduce(
			(s, m) =>
				s +
				(localPlans.get(slotKey(activePersona.id, weekId, viewDayIdx, m)) ?? []).reduce(
					(a, p) => a + p.carbs,
					0
				),
			0
		)}
		{@const target = activePersona.kcal_target ?? 0}
		{@const rawPct = target > 0 ? Math.round((totalKcal / target) * 100) : 0}
		{@const kcalPct = Math.min(100, rawPct)}
		{@const isWithin = target > 0 && rawPct >= 100 && rawPct <= 105}
		{@const isOver = target > 0 && rawPct > 105}
		{@const overBy = isOver ? totalKcal - target : 0}
		<!-- Pie chart: Б×4 / Ж×9 / У×4 ккал -->
		{@const macP = totalProtein * 4}
		{@const macF = totalFat * 9}
		{@const macC = totalCarbs * 4}
		{@const macT = macP + macF + macC}
		{@const C = 2 * Math.PI * 42}
		{@const segP = macT > 0 ? (macP / macT) * C : 0}
		{@const segF = macT > 0 ? (macF / macT) * C : 0}
		{@const segC = macT > 0 ? (macC / macT) * C : 0}
		{@const pctP = macT > 0 ? Math.round((macP / macT) * 100) : 0}
		{@const pctF = macT > 0 ? Math.round((macF / macT) * 100) : 0}
		{@const pctC = macT > 0 ? Math.round((macC / macT) * 100) : 0}

		<div class="flex-1 px-3 pt-3 pb-8">
			<!-- Двухколоночный layout: блюда | питание -->
			<div class="flex flex-col gap-4 md:flex-row">
				<!-- ── Левая колонка: блюда ──────────────────────────────────────── -->
				<div class="flex min-w-0 flex-col gap-3" style="flex: 3;">
					<!-- Итого вверху -->
					<div
						style="
          background: {isOver
							? 'var(--color-error-bg)'
							: isWithin
								? 'var(--color-green-tint)'
								: 'var(--color-bg-card)'};
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-card);
          border: 1px solid {isOver
							? 'var(--color-error-border)'
							: isWithin
								? 'var(--color-green-tint-border)'
								: 'var(--color-border)'};
          padding: 14px 16px;
          transition: background 0.2s, border-color 0.2s;
        "
					>
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-baseline gap-2">
								<span
									class="font-bold"
									style="font-size: 22px; color: {isOver
										? 'var(--color-error)'
										: isWithin
											? 'var(--color-green-primary)'
											: 'var(--color-text-primary)'};"
								>
									{totalKcal}
								</span>
								<span class="text-sm" style="color: var(--color-text-muted);"
									>ккал
									{#if target > 0}из {target}{/if}
								</span>
							</div>
							{#if target > 0}
								<span
									class="rounded-full px-2 py-0.5 text-sm font-semibold"
									style="
                  background: {isOver ? 'var(--color-error-bg)' : 'transparent'};
                  color: {isOver ? 'var(--color-error)' : 'var(--color-green-primary)'};
                  border: {isOver ? '1px solid var(--color-error-border)' : 'none'};
                ">{isOver ? `+${overBy} ккал` : isWithin ? `${rawPct}%` : `${kcalPct}%`}</span
								>
							{/if}
						</div>
						{#if target > 0}
							<!-- Прогресс-бар -->
							<div
								class="overflow-hidden rounded-full"
								style="height: 6px; background: var(--color-border); position: relative;"
							>
								<div
									class="h-full rounded-full transition-all"
									style="
                  width: {kcalPct}%;
                  background: {isOver
										? 'var(--color-error)'
										: totalKcal === 0
											? 'var(--color-border)'
											: kcalPct < 90
												? 'var(--color-warning)'
												: 'var(--color-green-primary)'};
                "
								></div>
							</div>
							<!-- Сообщение под баром -->
							{#if isOver}
								<p class="mt-1.5 text-xs font-medium" style="color: var(--color-error);">
									+{overBy} ккал сверх нормы
								</p>
							{:else if isWithin}
								<p
									class="mt-1.5 flex items-center gap-1 text-xs font-medium"
									style="color: var(--color-green-primary);"
								>
									<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;"
										><path
											d="M2 6l3 3 5-5"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linecap="round"
											stroke-linejoin="round"
										/></svg
									>
									В пределах допустимой погрешности ±5%
								</p>
							{:else if kcalPct < 90 && totalKcal > 0}
								<p
									class="mt-1.5 flex items-center gap-1 text-xs"
									style="color: var(--color-warning);"
								>
									<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;"
										><path
											d="M6 1.5L11 10H1L6 1.5z"
											stroke="currentColor"
											stroke-width="1.4"
											stroke-linecap="round"
											stroke-linejoin="round"
										/><path
											d="M6 5v2M6 8.5v.5"
											stroke="currentColor"
											stroke-width="1.4"
											stroke-linecap="round"
										/></svg
									>
									Не хватает ~{target - totalKcal} ккал до нормы
								</p>
							{/if}
						{/if}
					</div>

					<!-- Секции приёмов пищи -->
					{#each MEAL_KEYS as meal}
						{@const key = slotKey(activePersona.id, weekId, viewDayIdx, meal)}
						{@const plans = localPlans.get(key) ?? []}
						{@const slotKcal = plans.reduce((s, p) => s + p.kcal, 0)}

						<div
							style="
            background: var(--color-bg-card);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-card);
            border: 1px solid var(--color-border);
            overflow: hidden;
          "
						>
							<!-- Заголовок секции -->
							<div
								class="flex items-center justify-between px-4 py-2.5"
								style="border-bottom: 1px solid var(--color-border); background: var(--color-bg-page); border-left: 3px solid {mealAccentColor(
									meal
								)};"
							>
								<span
									class="flex items-center gap-2 text-sm font-semibold"
									style="color: var(--color-text-primary);"
								>
									<svg
										width="16"
										height="16"
										viewBox="0 0 16 16"
										fill="none"
										style="color: {mealAccentColor(meal)}; flex-shrink: 0;"
										>{@html mealIconPath(meal)}</svg
									>
									{MEAL_LABELS[meal]}
								</span>
								{#if slotKcal > 0}
									<span class="text-xs font-medium" style="color: var(--color-text-muted);"
										>{slotKcal} ккал</span
									>
								{/if}
							</div>

							<!-- Компактные строки блюд -->
							<div class="flex flex-col">
								{#each plans as plan (plan.id)}
									<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
									<div
										class="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors"
										style="border-bottom: 1px solid var(--color-border);"
										onclick={() => openDetail(plan)}
										onmouseenter={(e) =>
											((e.currentTarget as HTMLElement).style.background =
												'var(--color-green-tint)')}
										onmouseleave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
									>
										<!-- Фото -->
										{#if plan.dish_photo}
											<img
												src={plan.dish_photo}
												alt={plan.dish_name}
												class="shrink-0 rounded-lg object-cover"
												style="width: 44px; height: 44px;"
											/>
										{:else}
											<div
												class="flex shrink-0 items-center justify-center rounded-lg"
												style="width: 44px; height: 44px; background: var(--color-bg-page); color: var(--color-text-muted);"
											>
												<svg width="22" height="22" viewBox="0 0 22 22" fill="none">
													<circle
														cx="11"
														cy="11"
														r="8.5"
														stroke="currentColor"
														stroke-width="1.3"
													/>
													<path
														d="M7.5 9v2.5a3.5 3.5 0 0 0 7 0V9M11 11.5V16"
														stroke="currentColor"
														stroke-width="1.3"
														stroke-linecap="round"
													/>
												</svg>
											</div>
										{/if}

										<!-- Название + КБЖУ -->
										<div class="min-w-0 flex-1">
											<p
												class="truncate font-medium"
												style="font-size: 13px; color: var(--color-text-primary);"
											>
												{plan.dish_name}
											</p>
											<p class="mt-0.5 text-xs" style="color: var(--color-text-muted);">
												{plan.kcal} ккал · {plan.grams}г · Б{plan.protein} · Ж{plan.fat} · У{plan.carbs}
											</p>
										</div>

										<!-- Удалить -->
										{#if canEdit}
										<button
											type="button"
											onclick={(e) => {
												e.stopPropagation();
												handleRemove(plan);
											}}
											class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm transition-colors"
											style="color: var(--color-text-muted);"
											onmouseenter={(e) => {
												(e.currentTarget as HTMLElement).style.background = 'var(--color-error-bg)';
												(e.currentTarget as HTMLElement).style.color = 'var(--color-error)';
											}}
											onmouseleave={(e) => {
												(e.currentTarget as HTMLElement).style.background = '';
												(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
											}}
											aria-label="Удалить {plan.dish_name}"
										>
											<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
												<path
													d="M1 1l8 8M9 1L1 9"
													stroke="currentColor"
													stroke-width="1.8"
													stroke-linecap="round"
												/>
											</svg>
										</button>
										{/if}
									</div>
								{/each}

								<!-- + добавить блюдо -->
								{#if canEdit}
								<button
									type="button"
									onclick={() => openModal(viewDayIdx, meal)}
									class="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 transition-colors"
									style="border-top: 1px dashed var(--color-border); font-size: 13px; color: var(--color-text-muted);"
									onmouseenter={(e) => {
										const el = e.currentTarget as HTMLElement;
										el.style.background = 'var(--color-green-tint)';
										el.style.color = 'var(--color-green-primary)';
										el.style.borderTopColor = 'var(--color-green-soft)';
									}}
									onmouseleave={(e) => {
										const el = e.currentTarget as HTMLElement;
										el.style.background = '';
										el.style.color = 'var(--color-text-muted)';
										el.style.borderTopColor = 'var(--color-border)';
									}}
									aria-label="Добавить блюдо: {MEAL_LABELS[meal]}"
								>
									<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
										<path
											d="M7 2v10M2 7h10"
											stroke="currentColor"
											stroke-width="1.6"
											stroke-linecap="round"
										/>
									</svg>
									Добавить блюдо
								</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<!-- ── Правая колонка: питание ───────────────────────────────────── -->
				<div class="flex min-w-0 flex-col gap-3" style="flex: 2;">
					<div
						style="
          background: var(--color-bg-card);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-card);
          border: 1px solid var(--color-border);
          padding: 16px;
        "
					>
						<p
							class="mb-4 font-semibold"
							style="font-size: 15px; color: var(--color-text-primary);"
						>
							Питание
						</p>

						{#if macT > 0}
							<!-- SVG Donut chart -->
							<div class="mb-5 flex items-center justify-center gap-4">
								<svg
									viewBox="0 0 100 100"
									style="width: 60%; max-width: 220px; flex-shrink: 0; overflow: visible;"
								>
									<circle
										cx="50"
										cy="50"
										r="42"
										fill="none"
										stroke="var(--color-border)"
										stroke-width="12"
									/>
									<circle
										cx="50"
										cy="50"
										r="42"
										fill="none"
										stroke="var(--color-macro-protein)"
										stroke-width="12"
										stroke-dasharray="{segP} {C}"
										stroke-dashoffset="0"
										transform="rotate(-90 50 50)"
									/>
									<circle
										cx="50"
										cy="50"
										r="42"
										fill="none"
										stroke="var(--color-macro-fat)"
										stroke-width="12"
										stroke-dasharray="{segF} {C}"
										stroke-dashoffset={-segP}
										transform="rotate(-90 50 50)"
									/>
									<circle
										cx="50"
										cy="50"
										r="42"
										fill="none"
										stroke="var(--color-macro-carbs)"
										stroke-width="12"
										stroke-dasharray="{segC} {C}"
										stroke-dashoffset={-(segP + segF)}
										transform="rotate(-90 50 50)"
									/>
									<text
										x="50"
										y="46"
										text-anchor="middle"
										font-size="12"
										font-weight="700"
										fill="var(--color-text-primary)">{totalKcal}</text
									>
									<text
										x="50"
										y="59"
										text-anchor="middle"
										font-size="7.5"
										fill="var(--color-text-muted)">ккал</text
									>
								</svg>

								<!-- Легенда -->
								<div class="flex flex-col gap-3">
									<div class="flex items-center gap-2">
										<span
											class="h-3 w-3 shrink-0 rounded-full"
											style="background: var(--color-macro-protein);"
										></span>
										<span class="text-sm" style="color: var(--color-text-primary);"
											>Белки <strong>{pctP}%</strong></span
										>
									</div>
									<div class="flex items-center gap-2">
										<span
											class="h-3 w-3 shrink-0 rounded-full"
											style="background: var(--color-macro-fat);"
										></span>
										<span class="text-sm" style="color: var(--color-text-primary);"
											>Жиры <strong>{pctF}%</strong></span
										>
									</div>
									<div class="flex items-center gap-2">
										<span
											class="h-3 w-3 shrink-0 rounded-full"
											style="background: var(--color-macro-carbs);"
										></span>
										<span class="text-sm" style="color: var(--color-text-primary);"
											>Углеводы <strong>{pctC}%</strong></span
										>
									</div>
								</div>
							</div>

							<!-- Таблица факт / цель -->
							<table style="width: 100%; border-collapse: collapse; font-size: 13px;">
								<thead>
									<tr>
										<th
											style="text-align: left; padding: 4px 0; color: var(--color-text-muted); font-weight: 600;"
										></th>
										<th
											style="text-align: right; padding: 4px 8px; color: var(--color-text-muted); font-weight: 600;"
											>Факт</th
										>
										{#if target > 0}
											<th
												style="text-align: right; padding: 4px 0; color: var(--color-green-primary); font-weight: 600;"
												>Цель</th
											>
										{/if}
									</tr>
								</thead>
								<tbody>
									<tr style="border-top: 1px solid var(--color-border);">
										<td style="padding: 6px 0; color: var(--color-text-primary);">Калории</td>
										<td
											style="text-align: right; padding: 6px 8px; font-weight: 600; color: var(--color-text-primary);"
											>{totalKcal}</td
										>
										{#if target > 0}<td style="text-align: right; color: var(--color-text-muted);"
												>{target}</td
											>{/if}
									</tr>
									<tr style="border-top: 1px solid var(--color-border);">
										<td style="padding: 6px 0; color: var(--color-macro-protein); font-weight: 600;"
											>Белки</td
										>
										<td
											style="text-align: right; padding: 6px 8px; font-weight: 600; color: var(--color-text-primary);"
											>{totalProtein}г</td
										>
										{#if activePersona.protein_target}<td
												style="text-align: right; color: var(--color-text-muted);"
												>{activePersona.protein_target}г</td
											>
										{:else if target > 0}<td
												style="text-align: right; color: var(--color-text-muted);">—</td
											>{/if}
									</tr>
									<tr style="border-top: 1px solid var(--color-border);">
										<td style="padding: 6px 0; color: var(--color-macro-fat); font-weight: 600;"
											>Жиры</td
										>
										<td
											style="text-align: right; padding: 6px 8px; font-weight: 600; color: var(--color-text-primary);"
											>{totalFat}г</td
										>
										{#if target > 0}<td style="text-align: right; color: var(--color-text-muted);"
												>—</td
											>{/if}
									</tr>
									<tr style="border-top: 1px solid var(--color-border);">
										<td style="padding: 6px 0; color: var(--color-macro-carbs); font-weight: 600;"
											>Углеводы</td
										>
										<td
											style="text-align: right; padding: 6px 8px; font-weight: 600; color: var(--color-text-primary);"
											>{totalCarbs}г</td
										>
										{#if target > 0}<td style="text-align: right; color: var(--color-text-muted);"
												>—</td
											>{/if}
									</tr>
								</tbody>
							</table>
						{:else}
							<p class="py-8 text-center text-sm" style="color: var(--color-text-muted);">
								Добавьте блюда,<br />чтобы увидеть статистику
							</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

{#if fridgeModalOpen}
	<FridgeSelectModal
		fridgeItems={fridgeItems}
		ongenerate={handleFridgeGenerate}
		onclose={() => (fridgeModalOpen = false)}
	/>
{/if}

<!-- ── Умная замена блюда ─────────────────────────────────────────────── -->
{#if smartReplacePlan}
	<SmartReplaceModal
		sourcePlan={smartReplacePlan}
		catalog={(page.data.foodCatalog ?? []) as Dish[]}
		customDishes={page.data.customDishes ?? []}
		onreplace={(dish, grams) => handleSmartReplace(dish, grams)}
		onmanual={handleSmartReplaceManual}
		onclose={() => (smartReplacePlan = null)}
	/>
{/if}

<!-- ── Модалка выбора блюда ──────────────────────────────────────────── -->
{#if openSlot}
	<MealModal
		mealKey={openSlot.meal}
		dayLabel={openSlot.dayLabel}
		onselect={handleSelect}
		onclose={() => {
			openSlot = null;
			replacingPlan = null;
		}}
		foodCatalog={(page.data.foodCatalog ?? []) as Dish[]}
	/>
{/if}

<!-- ── Детальная карточка блюда ───────────────────────────────────────── -->
{#if detailPlan}
	{@const detailDish = (() => {
		const catalog = (page.data.foodCatalog ?? []) as Dish[];
		const fromCatalog = catalog.find((d) => d.name === detailPlan!.dish_name);
		if (fromCatalog) return fromCatalog;
		const customs = (page.data.customDishes ?? []) as import('$lib/types/database.js').CustomDish[];
		const fromCustom = customs.find((c) => c.data.name === detailPlan!.dish_name);
		if (!fromCustom) return null;
		const d = fromCustom.data;
		return {
			id: fromCustom.id,
			name: d.name,
			category: d.category,
			kcal_per_100g: d.kcal_per_100g,
			protein_per_100g: d.protein_per_100g,
			fat_per_100g: d.fat_per_100g,
			carbs_per_100g: d.carbs_per_100g,
			portion_min_g: 50,
			portion_max_g: 1000,
			portion_default_g: d.portion_default_g,
			cost_per_100g: d.cost_per_100g,
			photo: undefined,
			ingredients: d.ingredients
		} satisfies Dish;
	})()}
	<DishDetailModal
		name={detailPlan.dish_name}
		photo={detailPlan.dish_photo}
		kcal={detailPlan.kcal}
		protein={detailPlan.protein}
		fat={detailPlan.fat}
		carbs={detailPlan.carbs}
		grams={detailPlan.grams}
		cost={detailPlan.cost}
		dish={detailDish}
		onclose={() => (detailPlan = null)}
		onremove={() => {
			handleRemove(detailPlan!);
			detailPlan = null;
		}}
		onreplace={() => handleDetailReplace(detailPlan!)}
	/>
{/if}

<!-- ── Диалог подтверждения генерации ────────────────────────────────── -->
{#if showGenConfirm}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 flex items-center justify-center px-4"
		style="background: var(--color-overlay); z-index: var(--z-modal);"
		onclick={() => (showGenConfirm = false)}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="modal-enter w-full max-w-sm"
			style="background: var(--color-bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-modal); padding: 28px;"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="mb-2 font-semibold" style="font-size: 18px; color: var(--color-text-primary);">
				Заменить меню?
			</h3>
			<p class="mb-6 text-sm" style="color: var(--color-text-muted); line-height: 1.6;">
				Все блюда на этой неделе будут заменены. Это действие нельзя отменить.
			</p>
			<div class="flex justify-end gap-3">
				<button
					type="button"
					onclick={() => (showGenConfirm = false)}
					class="btn-secondary"
					style="width: auto; padding: 10px 20px;">Отмена</button
				>
				<button
					type="button"
					onclick={() => runGenerate()}
					class="btn-primary"
					style="width: auto; padding: 10px 20px;">Сгенерировать</button
				>
			</div>
		</div>
	</div>
{/if}

<!-- ── Подтверждение перезаписи недели ───────────────────────────────── -->
{#if copyWeekConfirm && copyWeekPending}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 flex items-center justify-center px-4"
		style="background: var(--color-overlay); z-index: var(--z-modal);"
		onclick={() => {
			copyWeekConfirm = false;
			copyWeekPending = null;
		}}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="modal-enter w-full max-w-sm"
			style="background: var(--color-bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-modal); padding: 28px;"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="mb-2 font-semibold" style="font-size: 18px; color: var(--color-text-primary);">
				Перезаписать неделю?
			</h3>
			<p class="mb-6 text-sm" style="color: var(--color-text-muted); line-height: 1.6;">
				Неделя <strong>{copyWeekPending.targetWeekId}</strong> уже содержит блюда. Перезаписать?
			</p>
			<div class="flex justify-end gap-3">
				<button
					type="button"
					onclick={() => {
						copyWeekConfirm = false;
						copyWeekPending = null;
					}}
					class="btn-secondary"
					style="width: auto; padding: 10px 20px;">Отмена</button
				>
				<button
					type="button"
					onclick={() => {
						const p = copyWeekPending;
						if (p) handleCopyWeekConfirmed(p.targetWeekId);
					}}
					class="btn-primary"
					style="width: auto; padding: 10px 20px;">Перезаписать</button
				>
			</div>
		</div>
	</div>
{/if}

<!-- ── Подтверждение копирования из другой персоны ───────────────────── -->
{#if copyFromConfirm && copyFromPending}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 flex items-center justify-center px-4"
		style="background: var(--color-overlay); z-index: var(--z-modal);"
		onclick={() => { copyFromConfirm = false; copyFromPending = null; }}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="modal-enter w-full max-w-sm"
			style="background: var(--color-bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-modal); padding: 28px;"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="mb-2 font-semibold" style="font-size: 18px; color: var(--color-text-primary);">
				{copyFromPending.mergeMode === 'replace' ? 'Заменить меню?' : 'Дополнить меню?'}
			</h3>
			<p class="mb-2 text-sm" style="color: var(--color-text-muted); line-height: 1.6;">
				{#if copyFromPending.mergeMode === 'replace'}
					Всё меню персоны <strong>{activePersona?.name}</strong> на неделе <strong>{weekId}</strong> будет заменено меню из <strong>{copyFromPending.sourcePersonaName}</strong>.
				{:else}
					Пустые слоты в меню <strong>{activePersona?.name}</strong> ({weekId}) будут заполнены из <strong>{copyFromPending.sourcePersonaName}</strong>.
				{/if}
			</p>
			{#if copyFromPending.previewCount > 0}
				<div class="mb-6 flex items-center gap-2 rounded-lg px-3 py-2" style="background: var(--color-green-tint); border: 1px solid var(--color-green-tint-border);">
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;color:var(--color-green-primary);"><path d="M2 7l3.5 3.5 6.5-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
					<span class="text-xs font-semibold" style="color: var(--color-green-primary);">
						{copyFromPending.previewCount} {copyFromPending.previewCount === 1 ? 'блюдо' : copyFromPending.previewCount < 5 ? 'блюда' : 'блюд'} будет скопировано
					</span>
				</div>
			{:else}
				<div class="mb-6 rounded-lg px-3 py-2" style="background: var(--color-bg-page); border: 1px solid var(--color-border);">
					<p class="text-xs" style="color: var(--color-text-muted);">Нет блюд для копирования (все слоты уже заполнены)</p>
				</div>
			{/if}
			<div class="flex justify-end gap-3">
				<button
					type="button"
					onclick={() => { copyFromConfirm = false; copyFromPending = null; }}
					class="btn-secondary"
					style="width: auto; padding: 10px 20px;">Отмена</button>
				<button
					type="button"
					disabled={copyFromPending.previewCount === 0}
					onclick={handleCopyFromPersonaConfirmed}
					class="btn-primary"
					style="width: auto; padding: 10px 20px; opacity: {copyFromPending.previewCount === 0 ? '0.45' : '1'};">
					{copyFromPending.mergeMode === 'replace' ? 'Заменить' : 'Дополнить'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ── Подтверждение перезаписи дня ──────────────────────────────────── -->
{#if copyDayConfirm && copyDayPending}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 flex items-center justify-center px-4"
		style="background: var(--color-overlay); z-index: var(--z-modal);"
		onclick={() => {
			copyDayConfirm = false;
			copyDayPending = null;
		}}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="modal-enter w-full max-w-sm"
			style="background: var(--color-bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-modal); padding: 28px;"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="mb-2 font-semibold" style="font-size: 18px; color: var(--color-text-primary);">
				Перезаписать день?
			</h3>
			<p class="mb-6 text-sm" style="color: var(--color-text-muted); line-height: 1.6;">
				День <strong
					>{dayLabelFromWeekIdx(copyDayPending.targetWeekId, copyDayPending.targetDayIdx)}</strong
				> уже заполнен. Перезаписать?
			</p>
			<div class="flex justify-end gap-3">
				<button
					type="button"
					onclick={() => {
						copyDayConfirm = false;
						copyDayPending = null;
					}}
					class="btn-secondary"
					style="width: auto; padding: 10px 20px;">Отмена</button
				>
				<button
					type="button"
					onclick={() => {
						const p = copyDayPending;
						if (p) handleCopyDayConfirmed(p.targetWeekId, p.targetDayIdx);
					}}
					class="btn-primary"
					style="width: auto; padding: 10px 20px;">Перезаписать</button
				>
			</div>
		</div>
	</div>
{/if}

<!-- ── Toast (undo) ───────────────────────────────────────────────────── -->
{#if toast}
	<div
		class="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 shadow-lg"
		style="background: var(--color-text-primary); color: var(--color-text-inverse); min-width: 260px; max-width: 400px; box-shadow: var(--shadow-modal);"
	>
		<span class="flex-1 text-sm font-medium">{toast.message}</span>
		<button
			type="button"
			onclick={undoCopy}
			class="rounded-lg px-3 py-1 text-xs font-semibold transition-colors"
			style="background: var(--color-toast-action-bg); color: var(--color-text-inverse);"
			onmouseenter={(e) => {
				(e.currentTarget as HTMLElement).style.background = 'var(--color-toast-action-hover)';
			}}
			onmouseleave={(e) => {
				(e.currentTarget as HTMLElement).style.background = 'var(--color-toast-action-bg)';
			}}>Отменить ({toast.secondsLeft})</button
		>
		<button
			type="button"
			onclick={dismissToast}
			class="flex h-5 w-5 items-center justify-center rounded-full transition-colors"
			style="color: var(--color-toast-close);"
			aria-label="Закрыть"
		>
			<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
				<path
					d="M1 1l8 8M9 1L1 9"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</div>
{/if}
