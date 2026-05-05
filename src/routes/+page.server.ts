import type { PageServerLoad } from './$types.js';

export interface MenuPlanRow {
  id:            number;
  persona_id:    number;
  week_label:    string;
  day_index:     number;
  meal_key:      string;
  dish_name:     string;
  dish_photo:    string | null;
  dish_category: string | null;
  kcal:          number;
  protein:       number;
  fat:           number;
  carbs:         number;
  cost:          number | null;
  grams:         number;
  sort_order:    number;
}

export const load: PageServerLoad = async ({ locals, depends }) => {
  depends('supabase:menu');
  const { user } = await locals.safeGetSession();
  if (!user) return { menuPlans: [] as MenuPlanRow[] };

  const { data, error } = await locals.supabase
    .from('menu_plans')
    .select('id, persona_id, week_label, day_index, meal_key, dish_name, dish_photo, dish_category, kcal, protein, fat, carbs, cost, grams, sort_order')
    .order('week_label', { ascending: true })
    .order('sort_order',  { ascending: true });

  if (error) {
    console.error('menu_plans load error:', error.message);
    return { menuPlans: [] as MenuPlanRow[] };
  }

  const { data: menuTemplates } = await locals.supabase
    .from('menu_templates')
    .select('id, household_id, created_by, name, slots, created_at')
    .order('created_at', { ascending: false });

  return {
    menuPlans: (data ?? []) as MenuPlanRow[],
    menuTemplates: (menuTemplates ?? []) as import('$lib/types/database.js').MenuTemplate[],
  };
};
