import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types.js';
import type { Persona, Household, CustomDish, FridgeRow } from '$lib/types/database.js';
import type { Dish } from '$lib/types/dish.js';

// ── food_catalog cache (shared across all users, refreshes every 5 min) ──
let catalogCache: Dish[] | null = null;
let catalogCacheAt = 0;
const CATALOG_TTL = 5 * 60 * 1000; // 5 minutes

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
	const sidebarCollapsed = cookies.get('pm_sidebar') !== 'expanded';
	const { session, user } = await locals.safeGetSession();

	// Не авторизован → редирект на вход (кроме /auth)
	if (!session && !url.pathname.startsWith('/auth')) {
		redirect(303, `/auth?redirect=${encodeURIComponent(url.pathname + url.search)}`);
	}

	// Авторизован и зашёл на /auth → редирект на главную
	if (session && url.pathname === '/auth') {
		redirect(303, '/');
	}

	// Авторизован, нет персоны, не на онбординге → редирект на онбординг
	// (проверяем после загрузки данных — ниже)

	// Не авторизован — дальше грузить нечего
	if (!session || !user) {
		return {
			session,
			user,
			household: null as Household | null,
			householdId: null as string | null,
			ownHouseholdId: null as string | null,
			isOwner: false,
			persona: null as Persona | null,
			personas: [] as Persona[],
			sidebarCollapsed
		};
	}

	// ── Загружаем членство и домохозяйство ────────────────────
	const { data: memberData } = (await locals.supabase
		.from('household_members')
		.select('household_id, own_household_id')
		.eq('user_id', user.id)
		.single()) as {
		data: { household_id: string; own_household_id: string } | null;
		error: unknown;
	};

	const householdId = memberData?.household_id ?? null;
	const ownHouseholdId = memberData?.own_household_id ?? null;
	const isOwner = !!householdId && householdId === ownHouseholdId;

	// Загружаем данные домохозяйства отдельным запросом
	let household: Household | null = null;
	if (householdId) {
		const { data } = await locals.supabase
			.from('households')
			.select('*')
			.eq('id', householdId)
			.single();
		household = data ?? null;
	}

	// ── Загружаем персоны домохозяйства ──────────────────────
	let personas: Persona[] = [];
	let persona: Persona | null = null;

	if (householdId) {
		const { data: personasData } = await locals.supabase
			.from('personas')
			.select('*')
			.eq('household_id', householdId)
			.order('created_at', { ascending: true });

		personas = (personasData ?? []) as Persona[];
		persona = personas.find((p) => p.user_id === user.id) ?? null;
	}

	// Если пользователь вступил в чужое хозяйство, его персона находится
	// в собственном хозяйстве (own_household_id) — ищем там
	if (!persona && ownHouseholdId && ownHouseholdId !== householdId) {
		const { data: ownPersonaData } = await locals.supabase
			.from('personas')
			.select('*')
			.eq('household_id', ownHouseholdId)
			.eq('user_id', user.id)
			.maybeSingle();
		persona = (ownPersonaData as Persona | null) ?? null;
	}

	// Нет персоны и не на онбординге → редирект на онбординг
	// Есть персона и зашёл на онбординг → редирект на главную
	const onOnboarding = url.pathname.startsWith('/onboarding');
	if (!persona && !onOnboarding) {
		redirect(303, '/onboarding');
	}
	if (persona && onOnboarding) {
		redirect(303, '/');
	}

	// ── Загружаем кастомные блюда и холодильник ───────────────
	let customDishes: CustomDish[] = [];
	let fridgeItems: FridgeRow[] = [];
	if (householdId) {
		const [dishesRes, fridgeRes] = await Promise.all([
			locals.supabase
				.from('custom_dishes')
				.select('*')
				.eq('household_id', householdId)
				.order('created_at', { ascending: true }),
			locals.supabase
				.from('household_fridge')
				.select('*')
				.eq('household_id', householdId)
				.order('product_name', { ascending: true })
		]);
		customDishes = (dishesRes.data ?? []) as CustomDish[];
		fridgeItems = (fridgeRes.data ?? []) as FridgeRow[];
	}

	// ── Загружаем каталог блюд (с кешем) ─────────────────────
	if (!catalogCache || Date.now() - catalogCacheAt > CATALOG_TTL) {
		const { data: catalogData } = await locals.supabase
			.from('food_catalog')
			.select('*')
			.order('id', { ascending: true });
		catalogCache = (catalogData ?? []).map(
			(row: Record<string, unknown>) =>
				({
					...row,
					portion_min_g: 50,
					portion_max_g: 1000
				}) as Dish
		);
		catalogCacheAt = Date.now();
	}
	const foodCatalog = catalogCache;

	return {
		session,
		user,
		household,
		householdId,
		ownHouseholdId,
		isOwner,
		persona,
		personas,
		customDishes,
		fridgeItems,
		foodCatalog,
		sidebarCollapsed
	};
};
