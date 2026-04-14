# Meal Planning App — Domain Model / Entities Specification (Dish-based, revised)

Эта версия модели:
- использует **Dish (Блюдо)** вместо Recipe;
- добавляет сущность **Fridge (Холодильник)**;
- учитывает содержимое холодильника при формировании списка покупок;
- фиксирует статус покрытия ингредиентов остатками из холодильника;
- включает архитектурные замечания и критический разбор модели.

---

# 1. Критический архитектурный разбор модели

Ниже — честный разбор текущей модели с позиции senior backend / solution architect.

## 1.1. Что в модели хорошо

### Плюсы
- Убрана лишняя сущность `Recipe`, если продукт мыслит именно блюдами, а не кулинарными инструкциями.
- Центр модели понятный: `Dish -> DishIngredient -> Ingredient`.
- Есть основа для meal planning:
  - профиль пользователя,
  - цели питания,
  - блюда,
  - план питания,
  - список покупок.
- Логика КБЖУ на 100 г хорошо подходит для nutrition-first продукта.
- Есть база для pantry/fridge-aware shopping list.

## 1.2. Слабые места текущей модели

### 1. Смешение "пищевой" и "коммерческой" моделей
Сейчас `Ingredient` одновременно играет роли:
- пищевого ингредиента,
- товарной позиции,
- единицы закупки.

Это удобно для MVP, но архитектурно слабое место.

#### Почему это проблема
Например:
- "молоко" как ингредиент — это абстракция,
- а в магазине пользователь покупает "молоко 930 мл бренд X".

Для MVP это допустимо, но позже лучше разделить:
- `Ingredient` — абстрактная пищевая сущность,
- `Product` / `StoreProduct` — конкретная упаковка / SKU.

---

### 2. Недостаточно строгая работа с единицами измерения
`unit` в виде enum `g/ml/pcs` — хороший старт, но этого мало для масштабирования.

#### Риск
На практике встретятся:
- `kg`
- `l`
- `tbsp`
- `tsp`
- `clove`
- `slice`
- `pack`

Если не ввести нормальную систему конверсий, shopping list быстро станет неточным.

#### Рекомендация
Нужны:
- нормализованная сущность `MeasurementUnit`,
- признак базовой единицы,
- коэффициенты перевода.

---

### 3. Не разделены "требуемое количество" и "доступное количество"
Для холодильника и списка покупок это критично.

Если блюду нужно:
- 500 г помидоров,

а в холодильнике есть:
- 300 г помидоров,

то shopping list должен показывать:
- нужно всего: 500 г
- есть в холодильнике: 300 г
- докупить: 200 г
- покрыто полностью: false

Без этих отдельных полей интерфейс и логика будут хрупкими.

---

### 4. `Dish` хранит КБЖУ на 100 г, но не всегда понятен итоговый вес блюда
Если у блюда есть `calories_per_100g`, но нет:
- `total_weight_g`

то сложно:
- точно пересчитывать порции,
- проверять корректность,
- объяснять пользователю, откуда взялась порция.

#### Рекомендация
У `Dish` нужен:
- `total_weight_g`
- `portion_weight_g`
- опционально `portions_count`

---

### 5. Недостаточно аудита и traceability
Если план генерируется автоматически, полезно понимать:
- по каким правилам выбрано блюдо,
- из какой версии профиля,
- с какими ограничениями.

Для MVP это можно не хранить глубоко, но хотя бы одна техническая сущность заявки на генерацию полезна.

---

### 6. Сущность холодильника ранее была слишком упрощена
Обычный pantry item без контейнера — это не совсем холодильник.

Если пользователь хочет реальный UX:
- "это у меня в холодильнике",
- "это в морозилке",
- "это в шкафу",

то нужна модель:
- контейнер хранения (`Fridge`, `StorageLocation`)
- содержимое (`FridgeItem`)

---

## 1.3. Что я бы обязательно усилил даже для MVP

### Обязательно добавить
1. `total_weight_g` у `Dish`
2. явные поля покрытия остатков в `ShoppingListItem`
3. сущность `Fridge`
4. сущность `FridgeItem`
5. более строгую модель единиц измерения

### Можно отложить
1. store integrations
2. SKU / catalog products
3. историю генераций
4. user feedback на блюда

---

# 2. Основные сущности

## 2.1 User

### Атрибуты
- `id: UUID`
- `email: string`
- `phone: string | null`
- `password_hash: string | null`
- `auth_provider: enum (email, google, apple, telegram)`
- `status: enum (active, blocked)`
- `locale: string`
- `timezone: string`
- `created_at: datetime`
- `updated_at: datetime`

---

## 2.2 UserProfile

### Атрибуты
- `id: UUID`
- `user_id: UUID`
- `sex: enum (male, female, other)`
- `birth_date: date | null`
- `height_cm: int | null`
- `weight_kg: decimal | null`
- `target_weight_kg: decimal | null`
- `activity_level: enum`
- `goal: enum`
- `meals_per_day: int`
- `household_size: int`
- `cooking_skill: enum`
- `budget_level: enum`
- `created_at: datetime`
- `updated_at: datetime`

---

## 2.3 NutritionTarget

### Атрибуты
- `id: UUID`
- `user_id: UUID`
- `daily_calories: int`
- `protein_g: decimal`
- `fat_g: decimal`
- `carbs_g: decimal`
- `fiber_g: decimal | null`
- `meals_per_day: int`
- `is_active: boolean`
- `created_at: datetime`
- `updated_at: datetime`

---

# 3. Справочники

## 3.1 MeasurementUnit

Рекомендуемая справочная сущность единиц измерения.

### Атрибуты
- `id: UUID`
- `code: string`
  - примеры: `g`, `kg`, `ml`, `l`, `pcs`
- `name: string`
- `unit_type: enum`
  - `weight`
  - `volume`
  - `count`
- `base_unit_code: string`
- `conversion_factor_to_base: decimal`
- `created_at: datetime`
- `updated_at: datetime`

### Примеры
```json
[
  {
    "code": "g",
    "name": "Грамм",
    "unit_type": "weight",
    "base_unit_code": "g",
    "conversion_factor_to_base": 1
  },
  {
    "code": "kg",
    "name": "Килограмм",
    "unit_type": "weight",
    "base_unit_code": "g",
    "conversion_factor_to_base": 1000
  }
]
```

---

## 3.2 IngredientCategory

### Атрибуты
- `id: UUID`
- `code: string`
- `name: string`
- `parent_id: UUID | null`
- `created_at: datetime`
- `updated_at: datetime`

---

## 3.3 Ingredient

### Атрибуты
- `id: UUID`
- `category_id: UUID | null`
- `name: string`
- `slug: string`
- `base_unit_code: string`
- `calories_per_100g: decimal | null`
- `protein_per_100g: decimal | null`
- `fat_per_100g: decimal | null`
- `carbs_per_100g: decimal | null`
- `fiber_per_100g: decimal | null`
- `avg_price_per_base_unit: decimal | null`
- `created_at: datetime`
- `updated_at: datetime`

### Пример
```json
{
  "id": "ing_tomato",
  "name": "Помидор",
  "base_unit_code": "g",
  "calories_per_100g": 18,
  "protein_per_100g": 0.9,
  "fat_per_100g": 0.2,
  "carbs_per_100g": 3.9
}
```

---

# 4. Блюда

## 4.1 Dish

Главная продуктовая сущность.

### Атрибуты
- `id: UUID`
- `name: string`
- `slug: string`
- `description: text | null`
- `cuisine: string | null`
- `difficulty: enum (easy, medium, hard)`
- `prep_time_min: int`
- `cook_time_min: int`
- `total_time_min: int`

### Масса блюда
- `total_weight_g: decimal`
- `portion_weight_g: decimal | null`
- `portions_count: int | null`

### КБЖУ на 100 г
- `calories_per_100g: decimal`
- `protein_per_100g: decimal`
- `fat_per_100g: decimal`
- `carbs_per_100g: decimal`
- `fiber_per_100g: decimal | null`

### Дополнительно
- `estimated_cost_per_portion: decimal | null`
- `is_batch_cooking_friendly: boolean`
- `is_freezable: boolean`
- `shelf_life_hours: int | null`
- `image_url: string | null`
- `created_at: datetime`
- `updated_at: datetime`

### Пример
```json
{
  "id": "dish_omelet",
  "name": "Омлет с помидорами",
  "total_weight_g": 500,
  "calories_per_100g": 155,
  "protein_per_100g": 11,
  "fat_per_100g": 12,
  "carbs_per_100g": 2,
  "portion_weight_g": 250,
  "portions_count": 2
}
```

---

## 4.2 DishIngredient

Связь блюда и ингредиента.

### Атрибуты
- `id: UUID`
- `dish_id: UUID`
- `ingredient_id: UUID`
- `quantity: decimal`
- `unit_code: string`
- `quantity_in_base_unit: decimal | null`
- `preparation_note: string | null`
- `is_optional: boolean`
- `sort_order: int`
- `created_at: datetime`
- `updated_at: datetime`

### Пример
```json
{
  "dish_id": "dish_omelet",
  "ingredient_id": "egg",
  "quantity": 2,
  "unit_code": "pcs",
  "quantity_in_base_unit": null
}
```

---

# 5. План питания

## 5.1 MealPlan

### Атрибуты
- `id: UUID`
- `user_id: UUID`
- `nutrition_target_id: UUID | null`
- `title: string`
- `start_date: date`
- `end_date: date`
- `days_count: int`
- `status: enum (draft, active, completed)`
- `created_at: datetime`
- `updated_at: datetime`

---

## 5.2 MealPlanDay

### Атрибуты
- `id: UUID`
- `meal_plan_id: UUID`
- `date: date`
- `day_index: int`
- `target_calories: int | null`
- `actual_calories: decimal | null`
- `created_at: datetime`
- `updated_at: datetime`

---

## 5.3 MealPlanItem

### Атрибуты
- `id: UUID`
- `meal_plan_day_id: UUID`
- `meal_type: enum (breakfast, lunch, dinner, snack)`
- `dish_id: UUID`
- `servings: decimal`
- `is_locked: boolean`
- `is_completed: boolean`
- `scheduled_time: time | null`
- `calories: decimal | null`
- `protein_g: decimal | null`
- `fat_g: decimal | null`
- `carbs_g: decimal | null`
- `created_at: datetime`
- `updated_at: datetime`

---

# 6. Холодильник и его содержимое

## 6.1 Fridge

Сущность пользовательского холодильника / зоны хранения.

Даже если физически холодильник один, отдельная сущность полезна для расширения:
- холодильник,
- морозилка,
- кладовка.

### Атрибуты
- `id: UUID`
- `user_id: UUID`
- `name: string`
  - примеры: `Основной холодильник`, `Морозилка`, `Кладовка`
- `storage_type: enum`
  - `fridge`
  - `freezer`
  - `pantry`
- `is_default: boolean`
- `created_at: datetime`
- `updated_at: datetime`

### Пример
```json
{
  "id": "fridge_main",
  "user_id": "user_1",
  "name": "Основной холодильник",
  "storage_type": "fridge",
  "is_default": true
}
```

---

## 6.2 FridgeItem

Конкретный продукт, который есть у пользователя в холодильнике.

### Атрибуты
- `id: UUID`
- `fridge_id: UUID`
- `ingredient_id: UUID`
- `quantity: decimal`
- `unit_code: string`
- `quantity_in_base_unit: decimal | null`
- `expires_at: datetime | null`
- `notes: text | null`
- `created_at: datetime`
- `updated_at: datetime`

### Пример
```json
{
  "id": "fridge_item_1",
  "fridge_id": "fridge_main",
  "ingredient_id": "ing_tomato",
  "quantity": 300,
  "unit_code": "g",
  "quantity_in_base_unit": 300,
  "expires_at": "2026-04-12T18:00:00Z",
  "notes": "Открытая упаковка"
}
```

---

# 7. Список покупок

## 7.1 ShoppingList

### Атрибуты
- `id: UUID`
- `user_id: UUID`
- `meal_plan_id: UUID | null`
- `title: string`
- `status: enum (draft, active, completed)`
- `total_estimated_cost: decimal | null`
- `created_at: datetime`
- `updated_at: datetime`

---

## 7.2 ShoppingListItem

Эта сущность должна учитывать не только "что нужно купить", но и "что уже есть в холодильнике".

### Атрибуты
- `id: UUID`
- `shopping_list_id: UUID`
- `ingredient_id: UUID | null`
- `display_name: string`

### Требуемое количество
- `required_quantity: decimal`
- `required_unit_code: string`
- `required_quantity_in_base_unit: decimal | null`

### Количество в холодильнике
- `available_in_fridge_quantity: decimal | null`
- `available_in_fridge_unit_code: string | null`
- `available_in_fridge_quantity_in_base_unit: decimal | null`

### Количество к покупке
- `to_buy_quantity: decimal | null`
- `to_buy_unit_code: string | null`
- `to_buy_quantity_in_base_unit: decimal | null`

### Статусы
- `is_checked: boolean`
- `is_available_in_fridge: boolean`
- `is_fully_covered_by_fridge: boolean`

### Дополнительно
- `estimated_price: decimal | null`
- `source_dish_ids: json | null`
- `created_at: datetime`
- `updated_at: datetime`

### Логика
1. Если ингредиент найден в `FridgeItem`, то:
   - `is_available_in_fridge = true`
   - в item показывается доступное количество.

2. Если доступное количество >= требуемому:
   - `is_fully_covered_by_fridge = true`
   - `to_buy_quantity = 0`
   - `is_checked = true`

3. Если доступное количество < требуемого:
   - `is_fully_covered_by_fridge = false`
   - `to_buy_quantity = required - available`
   - `is_checked = false`

### Пример 1 — продукта хватает
```json
{
  "display_name": "Помидоры",
  "required_quantity": 500,
  "required_unit_code": "g",
  "available_in_fridge_quantity": 600,
  "available_in_fridge_unit_code": "g",
  "to_buy_quantity": 0,
  "to_buy_unit_code": "g",
  "is_available_in_fridge": true,
  "is_fully_covered_by_fridge": true,
  "is_checked": true
}
```

### Пример 2 — продукта не хватает
```json
{
  "display_name": "Помидоры",
  "required_quantity": 500,
  "required_unit_code": "g",
  "available_in_fridge_quantity": 300,
  "available_in_fridge_unit_code": "g",
  "to_buy_quantity": 200,
  "to_buy_unit_code": "g",
  "is_available_in_fridge": true,
  "is_fully_covered_by_fridge": false,
  "is_checked": false
}
```

### Пример 3 — продукта нет в холодильнике
```json
{
  "display_name": "Помидоры",
  "required_quantity": 500,
  "required_unit_code": "g",
  "available_in_fridge_quantity": 0,
  "available_in_fridge_unit_code": "g",
  "to_buy_quantity": 500,
  "to_buy_unit_code": "g",
  "is_available_in_fridge": false,
  "is_fully_covered_by_fridge": false,
  "is_checked": false
}
```

---

# 8. Минимальная логика генерации списка покупок с учетом холодильника

Алгоритм на уровне домена:

1. Собрать все `DishIngredient` из блюд текущего `MealPlan`.
2. Агрегировать одинаковые `ingredient_id`.
3. Перевести количества в базовые единицы, где возможно.
4. Найти суммарные остатки по `FridgeItem` для этого пользователя.
5. Для каждого ингредиента вычислить:
   - `required_quantity`
   - `available_in_fridge_quantity`
   - `to_buy_quantity`
6. Если `available >= required`, то:
   - ставить `is_fully_covered_by_fridge = true`
   - ставить `is_checked = true`
7. Если `available < required`, то:
   - ставить `to_buy_quantity = required - available`

---

# 9. Связи между сущностями

## Основные связи
- `User 1 -> N UserProfile`
- `User 1 -> N NutritionTarget`
- `IngredientCategory 1 -> N Ingredient`
- `MeasurementUnit 1 -> N Ingredient`
- `Dish 1 -> N DishIngredient`
- `Ingredient 1 -> N DishIngredient`
- `User 1 -> N MealPlan`
- `MealPlan 1 -> N MealPlanDay`
- `MealPlanDay 1 -> N MealPlanItem`
- `Dish 1 -> N MealPlanItem`
- `User 1 -> N Fridge`
- `Fridge 1 -> N FridgeItem`
- `Ingredient 1 -> N FridgeItem`
- `User 1 -> N ShoppingList`
- `ShoppingList 1 -> N ShoppingListItem`
- `Ingredient 1 -> N ShoppingListItem`

---

# 10. Минимальный набор сущностей для MVP

1. `User`
2. `UserProfile`
3. `NutritionTarget`
4. `MeasurementUnit`
5. `IngredientCategory`
6. `Ingredient`
7. `Dish`
8. `DishIngredient`
9. `MealPlan`
10. `MealPlanDay`
11. `MealPlanItem`
12. `Fridge`
13. `FridgeItem`
14. `ShoppingList`
15. `ShoppingListItem`

---

# 11. Что Claude Code должен проверить

1. Сравнить текущие модели проекта с этим файлом.
2. Проверить, есть ли строгая модель `Dish` вместо `Recipe`.
3. Проверить, есть ли у `Dish`:
   - `total_weight_g`
   - КБЖУ на 100 г
   - `portion_weight_g`
4. Проверить, есть ли связь `DishIngredient`.
5. Проверить, есть ли единицы измерения как отдельный справочник.
6. Проверить, есть ли `Fridge` и `FridgeItem`.
7. Проверить, учитывается ли холодильник при генерации shopping list.
8. Проверить, есть ли у `ShoppingListItem` поля:
   - required quantity
   - available in fridge
   - to buy
   - coverage flags
9. Проверить, что если холодильник покрывает количество полностью, то item автоматически помечается галочкой.
10. Предложить миграции и порядок внедрения без поломки текущей системы.

---

# 12. Краткий итог

Финальное ядро модели теперь выглядит так:

- пользователь и его цели;
- ингредиенты и единицы измерения;
- блюда и состав блюд;
- план питания;
- холодильник и его содержимое;
- список покупок с учетом холодильника.

Это уже выглядит как гораздо более зрелая архитектура для meal-planning продукта, чем простая модель "план + список покупок" без учета реальных остатков.
