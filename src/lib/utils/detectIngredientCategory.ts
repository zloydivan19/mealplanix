import { INGREDIENT_DICT } from '$lib/data/ingredient-dictionary.js';
import type { ShoppingCategory } from '$lib/types/dish.js';

export function detectCategory(name: string): ShoppingCategory {
  const key = name.trim().toLowerCase();
  if (!key) return 'other';

  // Exact match
  if (INGREDIENT_DICT[key]) return INGREDIENT_DICT[key];

  // Partial match — key contains ingredient word or ingredient word contains key
  for (const [k, cat] of Object.entries(INGREDIENT_DICT)) {
    if (key.includes(k) || k.includes(key)) return cat;
  }

  return 'other';
}
