# US-024 — Несколько блюд в одном приёме пищи

**Эпик:** Меню  
**Приоритет:** 🔴 критично  
**Статус:** ✔️ готово  
**Дата:** 2026-04-08

## Описание
Как пользователь, я хочу добавить несколько блюд в один приём пищи
(например на обед: борщ + салат + котлета),
чтобы план питания отражал реальный рацион семьи.

## Проблема (было)
`UNIQUE(persona_id, week_label, day_index, meal_key)` — один слот = одно блюдо.
Второе блюдо невозможно добавить без замены первого.

## Решение (стало)

Один слот = список из N блюд. Каждое блюдо — отдельная строка в `menu_plans`.
Уникальность снята, добавлен `sort_order` для порядка.

## UI слота

```
┌──────────────────────────────────┐
│ ЗАВТРАК              513 ккал    │
│ ┌────────────────────────────┐   │
│ │ [фото] Сырники  230 ккал ✕ │   │
│ └────────────────────────────┘   │
│ ┌────────────────────────────┐   │
│ │ [фото] Овсянка  160 ккал ✕ │   │
│ └────────────────────────────┘   │
│ [+ добавить блюдо]               │
└──────────────────────────────────┘
```

- **Лейбл приёма** — название + сумма ккал всех блюд слота (если > 0)
- **Список блюд** — карточки `MealCard` с кнопкой `✕` на каждой
- **Кнопка `+ добавить`** — всегда видна под списком, открывает `MealModal`
- **Пустой слот** — только кнопка `+ добавить блюдо` (без пунктирной рамки)

## Изменения схемы БД

```sql
-- Убираем ограничение одного блюда на слот
ALTER TABLE public.menu_plans
  DROP CONSTRAINT menu_plans_persona_id_week_label_day_index_meal_key_key;

-- Порядок блюд внутри слота
ALTER TABLE public.menu_plans
  ADD COLUMN sort_order smallint NOT NULL DEFAULT 0;
```

## Изменения логики

| Что | Было | Стало |
|-----|------|-------|
| `localPlans` | `Map<SlotKey, MenuPlanRow>` | `Map<SlotKey, MenuPlanRow[]>` |
| `handleSelect` | upsert (заменяет) | insert (добавляет) |
| `handleRemove` | delete по ключу | delete по `row.id` |
| Итог ккал слота | `plan.kcal` | `plans.reduce(sum + p.kcal, 0)` |
| Открытие модалки | клик на пустой слот | клик на `+ добавить` |

## Автогенерация

Без изменений логики — каждое блюдо генерируется как одна запись.
`sort_order = 0` для всех сгенерированных строк.

## Definition of Done
- [x] DROP UNIQUE constraint в Supabase
- [x] ADD COLUMN `sort_order` в Supabase
- [x] `MenuPlan` тип: добавлен `sort_order`
- [x] `localPlans: Map<SlotKey, MenuPlanRow[]>`
- [x] `handleSelect` — insert, `sort_order = plans.length`
- [x] `handleRemove` — delete по `row.id`, обновляет массив
- [x] Разметка слота: `{#each plans}` + кнопка `+ добавить`
- [x] Итог ккал в лейбле приёма
- [x] Итог ккал дня в заголовке карточки дня (уже был — пересчитывается)

## Изменения схемы Supabase
```sql
ALTER TABLE public.menu_plans
  DROP CONSTRAINT menu_plans_persona_id_week_label_day_index_meal_key_key;

ALTER TABLE public.menu_plans
  ADD COLUMN sort_order smallint NOT NULL DEFAULT 0;
```

## Затронутые файлы
- `src/routes/+page.svelte`
- `src/routes/+page.server.ts`
- `src/lib/types/database.ts`
- `docs/schema-v5.sql`
