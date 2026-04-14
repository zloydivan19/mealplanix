# US-026 — Указание граммовки при ручном добавлении блюда

**Эпик:** Меню  
**Приоритет:** 🟡 высокий  
**Статус:** 📋 не начато  
**Дата:** 2026-04-08

---

## Описание

Как пользователь, я хочу при ручном добавлении блюда указать количество граммов,
чтобы КБЖУ отражало именно то, сколько я реально съел — а не фиксированную дефолтную порцию.

---

## Проблема (было)

При выборе блюда в MealModal сразу вызывается `handleSelect(dish)` с `portion_default_g`.
Пользователь не может изменить граммовку — всегда добавляется 150г гречки, 200г курицы и т.д.
Это неудобно: реальная порция всегда разная.

---

## Решение — двухшаговая модалка

### Шаг 1 — Список блюд (как сейчас)
Пользователь видит список и выбирает блюдо. Клик на блюдо переходит на шаг 2.

### Шаг 2 — Экран ввода граммовки

```
← Назад              Завтрак / Понедельник

[фото 64px]  Овсянка
             150 ккал · Б5 Ж3 У28  ← пересчитывается в реальном времени

Граммы:  [  150  ]  г

         min 50г ————●———— max 400г

         [  Добавить  ]
```

- Поле граммовки — числовой input, default = `dish.portion_default_g`
- Значение зажато в `[dish.portion_min_g .. dish.portion_max_g]`
- КБЖУ под названием пересчитывается реактивно при каждом изменении
- Кнопка «Добавить» — вызывает `onselect(dish, grams)`
- Кнопка «← Назад» — возвращает к списку, не добавляя блюдо

---

## Изменения в коде

### MealModal.svelte
- Добавить `step: 'list' | 'portion'` — внутренний стейт экрана
- При клике на блюдо: `selectedDish = dish; step = 'portion'`
- Prop `onselect` меняет сигнатуру: `(dish: SeedDish, grams: number) => void`

### +page.svelte — handleSelect
```typescript
async function handleSelect(dish: SeedDish, grams: number) {
  // grams теперь приходит из модалки, не из portion_default_g
}
```

---

## КБЖУ пересчёт (реактивно)

```
k = grams / 100
kcal    = round(dish.kcal_per_100g    * k)
protein = round(dish.protein_per_100g * k)
fat     = round(dish.fat_per_100g     * k)
carbs   = round(dish.carbs_per_100g   * k)
cost    = round(dish.cost_per_100g    * k)
```

---

## Будущая совместимость с FatSecret

FatSecret отдаёт данные на 100г (`calories`, `protein`, `fat`, `carbohydrate`).
Структура `SeedDish` (`kcal_per_100g`, `protein_per_100g`, ...) уже совместима.
При интеграции FatSecret блюда из их API просто подставляются в тот же шаг 2 —
логика граммовки не меняется.

---

## Definition of Done

- [ ] MealModal: шаг 1 — список блюд (без изменений в UI)
- [ ] MealModal: шаг 2 — экран с фото, названием, КБЖУ (реактивно), input граммовки
- [ ] Кнопка «← Назад» возвращает к шагу 1
- [ ] `onselect(dish, grams)` — grams из input
- [ ] `handleSelect` в +page.svelte принимает grams вторым аргументом
- [ ] Граммовка зажата в `[portion_min_g .. portion_max_g]`
- [ ] `pnpm check` — 0 ошибок

## Затронутые файлы
- `src/lib/components/MealModal.svelte`
- `src/routes/+page.svelte` — handleSelect сигнатура
