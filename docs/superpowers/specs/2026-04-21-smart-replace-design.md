# V5-095 — Умная замена блюда

**Дата:** 2026-04-21  
**Статус:** approved  

---

## Цель

Когда пользователь хочет заменить блюдо в слоте, вместо ручного поиска по всему каталогу — система сразу предлагает похожие блюда, подобранные по БЖУ и категории.

---

## UX-поток

1. Пользователь кликает на блюдо в сетке → открывается `DishDetailModal`
2. Нажимает «Заменить»
3. Вместо `MealModal` открывается новый `SmartReplaceModal`
4. В модале:
   - Верхняя плашка «Заменяем» — показывает исходное блюдо (название, ккал, БЖУ)
   - Секция «Подобрано по БЖУ» — топ-5 из каталога, отсортированные по % совпадения
   - Секция «Мои блюда» — кастомные блюда пользователя, подходящие по критериям (если есть)
   - Кнопка «Показать ещё 5 →» — подгружает следующие 5 вариантов из каталога
   - Кнопка «Выбрать из каталога вручную» — открывает существующий `MealModal` (фоллбэк)
5. Клик на любое блюдо — немедленная замена (та же логика сохранения, что сейчас)

---

## Алгоритм подбора (`findSimilarDishes`)

**Входные данные:**
- `sourceDish`: исходное блюдо (ккал, Б, Ж, У на 100г, категория)
- `catalog`: массив `Dish[]` (каталог + кастомные)

**Фильтр:**
- Только блюда той же `category` (breakfast / lunch / dinner / snack)
- Исключить само исходное блюдо

**Score совпадения (0–100%):**

Считается на основе соотношений макронутриентов (% от ккал), а не абсолютных значений — чтобы замена не нарушала баланс БЖУ персоны:

```
protein_ratio  = protein_per_100g * 4 / kcal_per_100g
fat_ratio      = fat_per_100g    * 9 / kcal_per_100g
carbs_ratio    = carbs_per_100g  * 4 / kcal_per_100g
kcal_delta     = |kcal_candidate - kcal_source| / kcal_source

diff = |Δprotein_ratio| * 0.4
     + |Δfat_ratio|     * 0.3
     + |Δcarbs_ratio|   * 0.2
     + kcal_delta       * 0.1

score = max(0, 1 - diff * 3) * 100  →  округлить до целого
```

**Сортировка:** по убыванию score.  
**Показ:** топ-5 сразу, остальные — по кнопке «Показать ещё 5».

---

## Компоненты

### Новый: `src/lib/components/SmartReplaceModal.svelte`

**Props:**
```ts
interface Props {
  sourcePlan:   MenuPlanRow;        // заменяемое блюдо
  catalog:      Dish[];             // food_catalog
  customDishes: CustomDish[];       // кастомные блюда
  persona:      Persona;            // для масштабирования порции
  onreplace:    (dish: Dish) => void;
  onmanual:     () => void;         // открыть MealModal
  onclose:      () => void;
}
```

**Внутренняя логика:**
- Вызывает `findSimilarDishes()` при монтировании
- `$state showCount = 5` — управляет сколько показывается
- Кастомные блюда показываются в отдельной секции если их score > 50%
- Порция масштабируется через существующий `scaleDish()` под целевые ккал слота

### Новая функция: `findSimilarDishes` в `src/lib/utils/generate.ts`

```ts
export function findSimilarDishes(
  source: { kcal: number; protein: number; fat: number; carbs: number; category: string },
  catalog: Dish[]
): Array<{ dish: Dish; score: number }>
```

Возвращает весь отфильтрованный и отсортированный массив — UI сам решает сколько показывать.

### Изменения в `src/routes/+page.svelte`

- `handleDetailReplace()` открывает `SmartReplaceModal` вместо `MealModal`
- `onreplace` в `SmartReplaceModal` вызывает ту же логику `addDish` / `swapDish`, что и сейчас
- `onmanual` закрывает `SmartReplaceModal` и открывает `MealModal` (существующий флоу)

---

## Что НЕ входит в scope

- Учёт холодильника (это V5-097)
- Учёт повторений блюд на неделе
- Замена блюда сразу во всех слотах недели
- Сохранение истории замен

---

## Файлы затронутые

| Файл | Изменение |
|------|-----------|
| `src/lib/utils/generate.ts` | Добавить `findSimilarDishes()` |
| `src/lib/components/SmartReplaceModal.svelte` | Создать новый компонент |
| `src/routes/+page.svelte` | `handleDetailReplace` → открывает SmartReplaceModal |
