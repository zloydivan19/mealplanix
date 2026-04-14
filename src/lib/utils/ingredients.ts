import { SHOPPING_CATEGORY_ORDER, type ShoppingCategory } from '$lib/types/dish.js';
import type { Dish, CustomDish } from '$lib/types/database.js';

export interface CartItem {
  name:     string;
  category: ShoppingCategory;
  sources:  string[];
  totalQty: number | null;  // null = нет данных о количестве
  unit:     string | null;
}

export interface CartGroup {
  category: ShoppingCategory;
  items:    CartItem[];
}

/** Агрегирует ингредиенты из списка названий блюд, дедуплицирует по имени, собирает sources */
export function aggregateIngredients(
  dishNames:    string[],
  customDishes: CustomDish[] = [],
  foodCatalog:  Dish[] = [],
): CartGroup[] {
  const byKey = new Map<string, CartItem>();

  for (const dishName of dishNames) {
    const catalog = foodCatalog.find(c => c.name === dishName);
    const custom  = customDishes.find(d => d.data.name === dishName);
    const ingredients = catalog?.ingredients ?? custom?.data.ingredients ?? null;

    if (ingredients?.length) {
      for (const ing of ingredients) {
        const key = ing.name.trim().toLowerCase();
        const cat = (ing.category ?? 'other') as ShoppingCategory;
        const existing = byKey.get(key);
        if (existing) {
          if (!existing.sources.includes(dishName)) existing.sources.push(dishName);
          // суммируем qty если оба числа
          if (ing.qty != null && existing.totalQty != null) {
            existing.totalQty += ing.qty;
          }
        } else {
          byKey.set(key, {
            name: ing.name,
            category: cat,
            sources: [dishName],
            totalQty: ing.qty ?? null,
            unit: ing.unit ?? null,
          });
        }
      }
    } else {
      const key = dishName.trim().toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, { name: dishName, category: 'other', sources: [dishName], totalQty: null, unit: null });
      }
    }
  }

  const byCat = new Map<ShoppingCategory, CartItem[]>();
  for (const item of byKey.values()) {
    const arr = byCat.get(item.category) ?? [];
    arr.push(item);
    byCat.set(item.category, arr);
  }

  return SHOPPING_CATEGORY_ORDER
    .filter(cat => byCat.has(cat))
    .map(cat => ({ category: cat, items: byCat.get(cat)! }));
}
