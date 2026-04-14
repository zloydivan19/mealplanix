# US-090 — Единый тип блюда: рефакторинг источников данных

**Эпик:** Архитектура / Техдолг  
**Приоритет:** 🟡 высокий  
**Статус:** 📋 готово к разработке  
**Дата:** 2026-04-10

---

## Проблема

В коде существуют три несовместимых типа для одной сущности «блюдо»:

| Тип | Файл | Поля ккал |
|---|---|---|
| `SeedDish` | `seed-dishes.ts` | `kcal_per_100g`, `protein_per_100g`, `fat_per_100g`, `carbs_per_100g` |
| `FoodCatalogItem` | `types/database.ts` | `kcal`, `protein`, `fat`, `carbs` |
| `custom_dishes.data` | Supabase JSONB | `kcal_per_100g`, `protein_per_100g`, `fat_per_100g`, `carbs_per_100g` |

Из-за этого повсюду существуют конвертеры (`catalogToSeed`, `customToSeed`), которые создают лишние копии данных и скрывают реальный источник.

---

## Решение

Принять формат `custom_dishes` как эталон — суффикс `_per_100g` остаётся, он явно указывает что значения на 100г, а не на порцию.  
Ввести единый тип `Dish`. Поля КБЖУ: **`kcal_per_100g`, `protein_per_100g`, `fat_per_100g`, `carbs_per_100g`**.  
Колонки таблицы `food_catalog` переименовываются под этот стандарт.

---

## Новая архитектура

```
Supabase
  food_catalog     → Dish[]           (общий каталог, все пользователи)
  custom_dishes    → Dish[]           (личные блюда, по household_id)

Runtime
  Dish             (единственный тип блюда)
  no converters    (данные используются напрямую)
```

---

## Тип `Dish`

```typescript
// src/lib/types/dish.ts  (новый файл)

export type DishCategory    = 'breakfast' | 'main' | 'side' | 'salad' | 'snack';
export type ShoppingCategory = 'meat' | 'dairy' | 'grain' | 'vegetable' | 'fruit' | 'condiment' | 'other';

export interface DishIngredient {
  name:     string;
  category: ShoppingCategory;
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
  photo?:            string | null;
  ingredients:       DishIngredient[];
  _custom?:          boolean;  // маркер — блюдо пользователя
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
```

---

## Изменения в БД

### Миграция `food_catalog`

Колонки переименовываются под стандарт `_per_100g`:

```sql
-- Было:   -- Стало:
kcal    →  kcal_per_100g
protein →  protein_per_100g
fat     →  fat_per_100g
carbs   →  carbs_per_100g
```

`custom_dishes.data` уже использует `kcal_per_100g` — **не меняется**.

---

## Файлы к изменению

| Файл | Что меняется |
|---|---|
| `src/lib/types/dish.ts` | **NEW** — единый тип `Dish` + константы |
| `src/lib/types/database.ts` | Удалить `FoodCatalogItem`, `CustomDish` переводится на `Dish` |
| `src/lib/data/seed-dishes.ts` | Удалить `SEED_DISHES`, `DISHES_BY_CAT`, `SeedDish`, `Ingredient` — файл станет пустым и удаляется |
| `src/lib/utils/generate.ts` | Убрать `catalogToSeed`, `customToSeed` — работать напрямую с `Dish[]` |
| `src/lib/utils/ingredients.ts` | Тип `FoodCatalogItem` → `Dish` |
| `src/lib/components/MealModal.svelte` | Пропы и derived — `Dish` вместо `SeedDish` |
| `src/lib/components/DishDetailModal.svelte` | Проп `dish?: SeedDish` → `dish?: Dish` |
| `src/routes/+page.svelte` | Весь код с `SeedDish` → `Dish` |
| `src/routes/dishes/+page.svelte` | Форма сохраняет поля `kcal/protein/fat/carbs` |
| `src/routes/dishes/+page.server.ts` | INSERT в `custom_dishes` с новыми именами полей |
| `docs/migration-food-catalog-rename.sql` | **NEW** — SQL миграция: переименование колонок `food_catalog` |

---

## Acceptance criteria

- [ ] Тип `SeedDish` удалён из кодовой базы
- [ ] Тип `FoodCatalogItem` удалён из кодовой базы
- [ ] Все компоненты используют `Dish` напрямую без конвертеров
- [ ] `custom_dishes` в Supabase использует поля `kcal/protein/fat/carbs`
- [ ] Форма `/dishes` сохраняет и читает данные в новом формате
- [ ] Генерация меню работает корректно
- [ ] MealModal показывает все блюда (catalog + custom)
- [ ] Корзина агрегирует ингредиенты корректно
- [ ] DishDetailModal показывает ингредиенты для всех типов блюд
- [ ] Файл `seed-dishes.ts` удалён

---

## Порядок реализации

1. Создать `src/lib/types/dish.ts`
2. Написать SQL миграцию `custom_dishes`
3. Обновить `database.ts` и `generate.ts`
4. Обновить `ingredients.ts`
5. Обновить компоненты (`MealModal`, `DishDetailModal`, `+page.svelte`)
6. Обновить `/dishes` форму и server
7. Выполнить SQL миграцию в Supabase
8. Удалить `seed-dishes.ts`
