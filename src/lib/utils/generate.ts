import type { Dish, DishCategory } from '$lib/types/dish.js';
import type { CustomDish } from '$lib/types/database.js';
import type { MealKey } from '$lib/utils/week.js';

export interface GeneratedSlot {
  day_index:     number;
  meal_key:      MealKey;
  dish:          Dish;
  grams:         number;
  kcal:          number;
  protein:       number;
  fat:           number;
  carbs:         number;
  cost:          number;
  dish_category: string;
}

interface GenerateOptions {
  kcal_target:           number;
  meal_ratios:           { bf: number; ln: number; dn: number };
  carry_dinner_to_lunch: boolean;
  match_kcal:            boolean;
  customDishes?:         CustomDish[];
  foodCatalog?:          Dish[];
}

/** Converts a CustomDish DB row to Dish runtime format */
function customToDish(cd: CustomDish, idx: number): Dish {
  const d = cd.data;
  return {
    id:                -(idx + 1),
    name:              d.name,
    category:          d.category,
    kcal_per_100g:     d.kcal_per_100g,
    protein_per_100g:  d.protein_per_100g,
    fat_per_100g:      d.fat_per_100g,
    carbs_per_100g:    d.carbs_per_100g,
    portion_min_g:     50,
    portion_max_g:     1000,
    portion_default_g: d.portion_default_g,
    cost_per_100g:     d.cost_per_100g,
    photo:             undefined,
    ingredients:       d.ingredients,
    _custom:           true,
  };
}

/** Масштабирует блюдо до целевых ккал, зажимая порцию в реалистичном диапазоне */
function scaleDish(dish: Dish, target_kcal: number): Omit<GeneratedSlot, 'day_index' | 'meal_key'> {
  const rawGrams = Math.round(target_kcal / dish.kcal_per_100g * 100);
  const grams    = Math.min(Math.max(rawGrams, dish.portion_min_g), dish.portion_max_g);
  const k        = grams / 100;

  return {
    dish,
    grams,
    kcal:          Math.round(dish.kcal_per_100g    * k),
    protein:       Math.round(dish.protein_per_100g * k),
    fat:           Math.round(dish.fat_per_100g     * k),
    carbs:         Math.round(dish.carbs_per_100g   * k),
    cost:          Math.round(dish.cost_per_100g    * k),
    dish_category: dish.category,
  };
}

/** Выбрать блюдо из пула.
 *  match_kcal=true  → случайное из топ-3 ближайших по kcal_per_100g (разнообразие при перегенерации)
 *  match_kcal=false → случайное из всего пула
 *  excludeIds — исключить блюда из предыдущего дня */
function pickDish(
  dishes:     Dish[],
  target:     number,
  excludeIds: number[],
  matchKcal:  boolean,
): Dish {
  const pool = dishes.length > excludeIds.length
    ? dishes.filter(d => !excludeIds.includes(d.id))
    : dishes;

  if (!matchKcal) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Топ-3 ближайших по kcal_per_100g → случайный из них
  const sorted = [...pool].sort((a, b) =>
    Math.abs(a.kcal_per_100g - target) - Math.abs(b.kcal_per_100g - target)
  );
  const top = sorted.slice(0, Math.min(3, sorted.length));
  return top[Math.floor(Math.random() * top.length)];
}

/** Генерирует слоты для одного приёма пищи из нескольких компонентов */
function buildMealSlots(
  dayIndex:    number,
  mealKey:     MealKey,
  slotKcal:    number,
  components:  Array<{ category: DishCategory; ratio: number }>,
  prevIds:     Record<DishCategory, number[]>,
  matchKcal:   boolean,
  slots:       GeneratedSlot[],
  dishesByCat: Record<DishCategory, Dish[]>,
) {
  for (const comp of components) {
    const targetKcal = Math.round(slotKcal * comp.ratio);
    const dish = pickDish(dishesByCat[comp.category], targetKcal, prevIds[comp.category] ?? [], matchKcal);
    const scaled = scaleDish(dish, targetKcal);
    slots.push({ day_index: dayIndex, meal_key: mealKey, ...scaled });
  }
}

/** Извлечь id блюд предыдущего дня для категории */
function prevDayIds(slots: GeneratedSlot[], dayIndex: number, category: string): number[] {
  return slots
    .filter(s => s.day_index === dayIndex - 1 && s.dish_category === category)
    .map(s => s.dish.id);
}

export function generateWeekPlan(opts: GenerateOptions): GeneratedSlot[] {
  const { kcal_target, meal_ratios, carry_dinner_to_lunch, match_kcal, customDishes = [], foodCatalog = [] } = opts;

  const all: Dish[] = [
    ...foodCatalog,
    ...customDishes.map((cd, i) => customToDish(cd, i)),
  ];

  const dishesByCat: Record<DishCategory, Dish[]> = {
    breakfast: all.filter(d => d.category === 'breakfast'),
    main:      all.filter(d => d.category === 'main'),
    side:      all.filter(d => d.category === 'side'),
    salad:     all.filter(d => d.category === 'salad'),
    snack:     all.filter(d => d.category === 'snack'),
  };

  // Перекус — 10% от цели, основные приёмы делят оставшиеся 90%
  const kcal_sn   = Math.round(kcal_target * 0.10);
  const kcal_main = kcal_target - kcal_sn;
  const kcal_bf   = Math.round(kcal_main * meal_ratios.bf / 100);
  const kcal_ln   = Math.round(kcal_main * meal_ratios.ln / 100);
  const kcal_dn   = Math.round(kcal_main * meal_ratios.dn / 100);

  const slots: GeneratedSlot[] = [];

  for (let day = 0; day < 7; day++) {

    // ── Завтрак ───────────────────────────────────────────────────────────
    {
      const prevIds = prevDayIds(slots, day, 'breakfast');
      const dish1   = pickDish(dishesByCat.breakfast, kcal_bf * 0.7, prevIds, match_kcal);
      const s1      = scaleDish(dish1, kcal_bf * 0.7);
      slots.push({ day_index: day, meal_key: 'bf', ...s1 });

      const remaining = kcal_bf - s1.kcal;
      if (remaining >= 100) {
        const dish2 = pickDish(dishesByCat.breakfast, remaining, [dish1.id], match_kcal);
        const s2    = scaleDish(dish2, remaining);
        slots.push({ day_index: day, meal_key: 'bf', ...s2 });
      }
    }

    // ── Обед ─────────────────────────────────────────────────────────────
    if (carry_dinner_to_lunch && day > 0) {
      const prevMain = slots.find(s => s.day_index === day - 1 && s.meal_key === 'dn' && s.dish_category === 'main');
      if (prevMain) {
        slots.push({ ...prevMain, day_index: day, meal_key: 'ln' });
      }
      buildMealSlots(day, 'ln', kcal_ln, [
        { category: 'side',  ratio: 0.35 },
        { category: 'salad', ratio: 0.20 },
      ], {
        side:  prevDayIds(slots, day, 'side'),
        salad: prevDayIds(slots, day, 'salad'),
      } as Record<DishCategory, number[]>, match_kcal, slots, dishesByCat);
    } else {
      buildMealSlots(day, 'ln', kcal_ln, [
        { category: 'main',  ratio: 0.45 },
        { category: 'side',  ratio: 0.35 },
        { category: 'salad', ratio: 0.20 },
      ], {
        main:  prevDayIds(slots, day, 'main'),
        side:  prevDayIds(slots, day, 'side'),
        salad: prevDayIds(slots, day, 'salad'),
      } as Record<DishCategory, number[]>, match_kcal, slots, dishesByCat);
    }

    // ── Ужин ─────────────────────────────────────────────────────────────
    buildMealSlots(day, 'dn', kcal_dn, [
      { category: 'main',  ratio: 0.55 },
      { category: 'salad', ratio: 0.45 },
    ], {
      main:  prevDayIds(slots, day, 'main'),
      salad: prevDayIds(slots, day, 'salad'),
    } as Record<DishCategory, number[]>, match_kcal, slots, dishesByCat);

    // ── Перекус ───────────────────────────────────────────────────────────
    {
      const prevIds = prevDayIds(slots, day, 'snack');
      const dish1   = pickDish(dishesByCat.snack, kcal_sn, prevIds, match_kcal);
      const s1      = scaleDish(dish1, kcal_sn);
      slots.push({ day_index: day, meal_key: 'sn', ...s1 });

      if (kcal_sn - s1.kcal > kcal_sn * 0.4) {
        const dish2 = pickDish(dishesByCat.snack, kcal_sn - s1.kcal, [dish1.id], match_kcal);
        const s2    = scaleDish(dish2, kcal_sn - s1.kcal);
        slots.push({ day_index: day, meal_key: 'sn', ...s2 });
      }
    }
  }

  // ── Автоскейл: если день > target × 1.04, пропорционально уменьшаем порции ──
  for (let day = 0; day < 7; day++) {
    const daySlots = slots.filter(s => s.day_index === day);
    const dayKcal  = daySlots.reduce((s, r) => s + r.kcal, 0);
    if (dayKcal > kcal_target * 1.04) {
      const ratio = kcal_target / dayKcal;
      for (const slot of daySlots) {
        const newGrams = Math.round(slot.grams * ratio);
        const clamped  = Math.min(Math.max(newGrams, slot.dish.portion_min_g), slot.dish.portion_max_g);
        const k        = clamped / 100;
        slot.grams   = clamped;
        slot.kcal    = Math.round(slot.dish.kcal_per_100g    * k);
        slot.protein = Math.round(slot.dish.protein_per_100g * k);
        slot.fat     = Math.round(slot.dish.fat_per_100g     * k);
        slot.carbs   = Math.round(slot.dish.carbs_per_100g   * k);
        slot.cost    = Math.round(slot.dish.cost_per_100g    * k);
      }
    }
  }

  return slots;
}
