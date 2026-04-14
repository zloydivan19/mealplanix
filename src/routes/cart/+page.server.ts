import type { PageServerLoad } from './$types.js';

export interface CartStateRow {
  ingredient_name: string;
  price:           number;
  is_checked:      boolean;
}

export const load: PageServerLoad = async ({ locals }) => {
  const { user } = await locals.safeGetSession();
  if (!user) return { menuPlans: [], cartState: [] };

  const [plansRes, cartRes] = await Promise.all([
    locals.supabase
      .from('menu_plans')
      .select('week_label, dish_name')
      .order('week_label', { ascending: true }),
    locals.supabase
      .from('cart_state')
      .select('ingredient_name, price, is_checked'),
  ]);

  if (plansRes.error) console.error('cart plans load error:', plansRes.error.message);
  if (cartRes.error)  console.error('cart state load error:',  cartRes.error.message);

  return {
    menuPlans: (plansRes.data ?? []) as { week_label: string; dish_name: string }[],
    cartState: (cartRes.data ?? []) as CartStateRow[],
  };
};
