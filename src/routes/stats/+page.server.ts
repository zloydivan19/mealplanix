import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return { menuPlans: [] };

	const { data, error } = await locals.supabase
		.from('menu_plans')
		.select('id, persona_id, week_label, day_index, meal_key, dish_name, dish_category, dish_photo, grams, kcal, protein, fat, carbs')
		.order('week_label', { ascending: true });

	if (error) console.error('stats menu_plans load error:', error.message);

	return {
		menuPlans: data ?? []
	};
};
