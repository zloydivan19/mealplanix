export type DishCategory = 'breakfast' | 'main' | 'side' | 'salad' | 'snack';

export type ShoppingCategory = 'meat' | 'dairy' | 'grain' | 'vegetable' | 'fruit' | 'condiment' | 'other';

export interface DishIngredient {
  name:     string;
  category: ShoppingCategory;
  qty?:     number;   // количество на одну стандартную порцию
  unit?:    string;   // 'г' | 'мл' | 'шт' | 'щепотка'
}

export interface Dish {
  id:                number;
  name:              string;
  category:          DishCategory;
  kcal_per_100g:     number;
  protein_per_100g:  number;
  fat_per_100g:      number;
  carbs_per_100g:    number;
  portion_default_g: number;
  portion_min_g:     number;
  portion_max_g:     number;
  cost_per_100g:     number;
  standalone?:       boolean;
  photo?:            string | null;
  ingredients:       DishIngredient[];
  _custom?:          boolean;
}

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  meat:      'Мясо и рыба',
  dairy:     'Молочные продукты',
  grain:     'Крупы и выпечка',
  vegetable: 'Овощи',
  fruit:     'Фрукты',
  condiment: 'Специи и соусы',
  other:     'Прочее',
};

export const SHOPPING_CATEGORY_ORDER: ShoppingCategory[] = [
  'meat', 'dairy', 'grain', 'vegetable', 'fruit', 'condiment', 'other',
];
