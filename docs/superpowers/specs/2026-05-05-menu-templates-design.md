# V5-096 — Шаблоны меню: дизайн

**Дата:** 2026-05-05  
**Статус:** утверждён

---

## Суть фичи

Пользователь может сохранить текущую неделю меню (для активной персоны) как именованный шаблон и позднее применить его к любой неделе любой персоны, которой он управляет.

---

## Решения по ключевым вопросам

| Вопрос | Решение |
|---|---|
| Кому принадлежит шаблон | Домохозяйству (`household_id`) — виден всем участникам |
| Кто может применить | Только к персоне, где `canEdit = true` (существующая логика) |
| Точка входа в UI | Выпадающий список split-кнопки «Генерировать» |
| Режим применения | Модалка с выбором «Заменить всё» / «Только пустые» |
| Название шаблона | Вводится пользователем вручную при сохранении |
| Хранение | Новая таблица `menu_templates` в Supabase |

---

## База данных

### Таблица `menu_templates`

```sql
CREATE TABLE menu_templates (
  id           SERIAL PRIMARY KEY,
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by   UUID        NOT NULL REFERENCES auth.users(id),
  name         TEXT        NOT NULL,
  slots        JSONB       NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Структура `slots` (JSONB-массив)

Каждый элемент массива — один слот меню:

```ts
interface TemplateSlot {
  day_index:     number;       // 0–6
  meal_key:      string;       // 'bf' | 'ln' | 'dn'
  dish_name:     string;
  dish_photo:    string | null;
  dish_category: string | null;
  kcal:          number;
  protein:       number;
  fat:           number;
  carbs:         number;
  cost:          number | null;
  grams:         number;
  sort_order:    number;
}
```

### RLS

- `SELECT` — любой участник домохозяйства (`household_id` совпадает с активным `household_id` пользователя)
- `INSERT` — любой участник домохозяйства
- `DELETE` — только создатель (`created_by = auth.uid()`)

---

## TypeScript типы

Добавить в `src/lib/types/database.ts`:

```ts
export interface TemplateSlot {
  day_index:     number;
  meal_key:      string;
  dish_name:     string;
  dish_photo:    string | null;
  dish_category: string | null;
  kcal:          number;
  protein:       number;
  fat:           number;
  carbs:         number;
  cost:          number | null;
  grams:         number;
  sort_order:    number;
}

export interface MenuTemplate {
  id:           number;
  household_id: string;
  created_by:   string;
  name:         string;
  slots:        TemplateSlot[];
  created_at:   string;
}
```

Добавить `menu_templates` в `Database.public.Tables`.

---

## UI — компоненты и изменения

### Split-кнопка «Генерировать» (`+page.svelte`)

Добавить в выпадающий список два новых пункта:

```
[Генерировать]  [▾]
├── 🧊 С учётом холодильника   (существующий)
├── 📋 Сохранить как шаблон    (новый)
└── ✨ Применить шаблон…       (новый, disabled если templates.length === 0)
```

### `SaveTemplateModal.svelte` (новый)

- Поле ввода «Название шаблона» (required, max 60 символов)
- Кнопки «Отмена» / «Сохранить»
- При сохранении: собирает все `MenuPlanRow` текущей недели + активной персоны → преобразует в `TemplateSlot[]` → INSERT в `menu_templates`
- Toast «Шаблон сохранён» при успехе

### `ApplyTemplateModal.svelte` (новый)

- Список шаблонов домохозяйства (имя + дата создания)
- Выбор шаблона кликом (одиночный выбор)
- Радио-группа режима: **Заменить всё** / **Только пустые**
- Кнопки «Отмена» / «Применить»
- При применении: INSERT строки из `slots` шаблона в `menu_plans` для текущей (`weekId`) + активной (`personaId`), с учётом выбранного режима
- `invalidate('supabase:menu')` после применения

### `+page.server.ts`

Добавить загрузку шаблонов:
```ts
const { data: templates } = await locals.supabase
  .from('menu_templates')
  .select('id, name, created_by, slots, created_at')
  .order('created_at', { ascending: false });
```

Передать как `menuTemplates` в `PageData`.

---

## Файлы

| Файл | Действие |
|---|---|
| `database/migrations/migration-menu-templates.sql` | Новый — DDL + RLS |
| `src/lib/types/database.ts` | Добавить `TemplateSlot`, `MenuTemplate`, запись в `Database` |
| `src/lib/components/SaveTemplateModal.svelte` | Новый |
| `src/lib/components/ApplyTemplateModal.svelte` | Новый |
| `src/routes/+page.server.ts` | Загрузка `menu_templates` |
| `src/routes/+page.svelte` | Пункты в split-dropdown, подключение модалок |

---

## Ограничения

- Шаблон сохраняет только блюда (не КБЖУ-цели персоны, не настройки генерации)
- Нет лимита на количество шаблонов (можно добавить позже)
- Удалить шаблон — только в `ApplyTemplateModal` (кнопка «🗑» рядом с каждым), только создатель
- «Только пустые» — слот считается пустым, если в `menu_plans` нет ни одной строки с данным `(persona_id, week_label, day_index, meal_key)`
