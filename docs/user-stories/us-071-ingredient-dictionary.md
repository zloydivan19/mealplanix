# US-071 — Словарь ингредиентов: автодетект категории

**Эпик:** Блюда  
**Приоритет:** 🟡 высокий  
**Статус:** 📋 не начато  
**Дата:** 2026-04-08

---

## Описание

Как пользователь, я хочу вводить ингредиенты при создании кастомного блюда
и видеть их категорию автоматически, а для неизвестных — выбирать вручную,
чтобы они правильно попадали в разделы корзины.

---

## Источник данных

Статический файл `src/lib/data/ingredient-dictionary.ts`:

```typescript
export const INGREDIENT_DICT: Record<string, ShoppingCategory> = {
  // Мясо и рыба (~150)
  'курица':    'meat',
  'куриное филе': 'meat',
  'говядина':  'meat',
  'лосось':    'meat',
  // ...

  // Овощи (~200)
  'морковь':   'vegetable',
  'лук':       'vegetable',
  // ...

  // Молочные (~100)
  'молоко':    'dairy',
  'яйца':      'dairy',
  // ...

  // Крупы и выпечка (~100)
  'гречка':    'grain',
  'рис':       'grain',
  // ...

  // Фрукты (~80)
  'яблоко':    'fruit',
  'банан':     'fruit',
  // ...

  // Специи и соусы (~200)
  'соль':      'condiment',
  'перец':     'condiment',
  // ...

  // Прочее (~170)
  'орехи':     'other',
  // ...
};
```

Поиск: `name.trim().toLowerCase()` → категория. Не найдено → `'other'`.

---

## Поведение в форме кастомного блюда

1. Пользователь вводит ингредиент в поле (через запятую или Enter)
2. Каждый ингредиент становится тегом с цветным бейджем категории
3. Клик на тег → дропдаун со списком категорий → смена вручную
4. Неизвестные ингредиенты → `other` с иконкой ❓ — явный сигнал что нужно уточнить

```
Ингредиенты:
[🥩 куриное филе ▾]  [🥦 чеснок ▾]  [🧂 соль ▾]  [❓ кинза ▾]
```

---

## Функция детекта

```typescript
// src/lib/utils/detectIngredientCategory.ts
import { INGREDIENT_DICT } from '$lib/data/ingredient-dictionary.js';

export function detectCategory(name: string): ShoppingCategory {
  const key = name.trim().toLowerCase();
  // Точное совпадение
  if (INGREDIENT_DICT[key]) return INGREDIENT_DICT[key];
  // Частичное — ищем вхождение ключа в название
  for (const [k, cat] of Object.entries(INGREDIENT_DICT)) {
    if (key.includes(k) || k.includes(key)) return cat;
  }
  return 'other';
}
```

---

## Definition of Done

- [ ] `src/lib/data/ingredient-dictionary.ts` — ~1000 ингредиентов
- [ ] `src/lib/utils/detectIngredientCategory.ts` — функция детекта
- [ ] Форма в `/dishes` — теги вместо текстового поля
- [ ] Клик на тег → смена категории
- [ ] Неизвестные помечаются ❓
- [ ] При сохранении категории тегов записываются в `data.ingredients`
- [ ] `pnpm check` — 0 ошибок

## Затронутые файлы
- `src/lib/data/ingredient-dictionary.ts` — новый
- `src/lib/utils/detectIngredientCategory.ts` — новый
- `src/routes/dishes/+page.svelte` — обновить форму
