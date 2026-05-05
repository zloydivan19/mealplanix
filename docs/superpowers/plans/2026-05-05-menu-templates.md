# Menu Templates (V5-096) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Позволить пользователю сохранить текущую неделю меню как именованный шаблон и применить его к любой неделе любой персоны с правом редактирования.

**Architecture:** Новая таблица `menu_templates` в Supabase хранит шаблон как JSONB-массив слотов. Два новых компонента (`SaveTemplateModal`, `ApplyTemplateModal`) встраиваются в существующую split-кнопку «Сгенерировать» на главной странице планировщика. Логика применения переиспользует паттерн из существующего копирования меню между персонами (replace/fill).

**Tech Stack:** SvelteKit 2 + Svelte 5 Runes · Supabase (PostgreSQL + RLS) · TypeScript strict · Tailwind CSS v4 + CSS vars

---

## Файловая карта

| Файл | Действие |
|---|---|
| `docs/database/migrations/migration-menu-templates.sql` | Создать — DDL + RLS |
| `src/lib/types/database.ts` | Изменить — добавить `TemplateSlot`, `MenuTemplate`, запись в `Database` |
| `src/lib/components/SaveTemplateModal.svelte` | Создать |
| `src/lib/components/ApplyTemplateModal.svelte` | Создать |
| `src/routes/+page.server.ts` | Изменить — загружать `menu_templates` |
| `src/routes/+page.svelte` | Изменить — импорты, стейт, пункты в dropdown, рендер модалок |

---

## Task 1: Миграция БД

**Files:**
- Create: `docs/database/migrations/migration-menu-templates.sql`

- [ ] **Step 1.1: Создать SQL-файл миграции**

```sql
-- Миграция: шаблоны меню
-- Запустить в Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.menu_templates (
  id           bigserial    PRIMARY KEY,
  household_id text         NOT NULL,
  created_by   uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text         NOT NULL,
  slots        jsonb        NOT NULL DEFAULT '[]',
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_templates_household
  ON public.menu_templates(household_id);

ALTER TABLE public.menu_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can select templates"
ON public.menu_templates FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "household members can insert templates"
ON public.menu_templates FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

CREATE POLICY "creator can delete templates"
ON public.menu_templates FOR DELETE
USING (created_by = auth.uid());
```

- [ ] **Step 1.2: Выполнить SQL в Supabase**

Открыть https://supabase.com/dashboard/project/owhgigxcbclbrvildmhh/sql/new, вставить SQL из файла, нажать Run. Проверить что таблица появилась в Table Editor.

- [ ] **Step 1.3: Коммит**

```bash
git add docs/database/migrations/migration-menu-templates.sql
git commit -m "feat: V5-096 миграция таблицы menu_templates + RLS"
```

---

## Task 2: TypeScript типы

**Files:**
- Modify: `src/lib/types/database.ts`

- [ ] **Step 2.1: Добавить интерфейсы после `CartState`**

В `src/lib/types/database.ts` после блока `export interface CartState { ... }` добавить:

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

- [ ] **Step 2.2: Добавить `menu_templates` в `Database`**

В блоке `Database.public.Tables` добавить после записи `cart_state`:

```ts
menu_templates: {
  Row: AsRecord<MenuTemplate>;
  Insert: AsRecord<Omit<MenuTemplate, 'id' | 'created_at'>>;
  Update: AsRecord<Partial<Omit<MenuTemplate, 'id' | 'household_id' | 'created_by' | 'created_at'>>>;
  Relationships: [];
};
```

- [ ] **Step 2.3: Проверить TS**

```bash
pnpm check
```

Ожидаемый результат: 0 ошибок.

- [ ] **Step 2.4: Коммит**

```bash
git add src/lib/types/database.ts
git commit -m "feat: V5-096 типы MenuTemplate, TemplateSlot"
```

---

## Task 3: Загрузка шаблонов на сервере

**Files:**
- Modify: `src/routes/+page.server.ts`

- [ ] **Step 3.1: Добавить загрузку в `load()`**

В `src/routes/+page.server.ts` добавить в функцию `load` после загрузки `menuPlans`:

```ts
const { data: menuTemplates } = await locals.supabase
  .from('menu_templates')
  .select('id, household_id, created_by, name, slots, created_at')
  .order('created_at', { ascending: false });
```

И вернуть в объекте:

```ts
return {
  menuPlans: (data ?? []) as MenuPlanRow[],
  menuTemplates: (menuTemplates ?? []) as import('$lib/types/database.js').MenuTemplate[],
};
```

- [ ] **Step 3.2: Проверить TS**

```bash
pnpm check
```

Ожидаемый результат: 0 ошибок.

- [ ] **Step 3.3: Коммит**

```bash
git add src/routes/+page.server.ts
git commit -m "feat: V5-096 загрузка menu_templates в page.server.ts"
```

---

## Task 4: SaveTemplateModal

**Files:**
- Create: `src/lib/components/SaveTemplateModal.svelte`

- [ ] **Step 4.1: Создать компонент**

```svelte
<script lang="ts">
  import { browser } from '$app/environment';

  interface Props {
    onsave:  (name: string) => void;
    onclose: () => void;
  }

  let { onsave, onclose }: Props = $props();

  let name = $state('');
  let saving = $state(false);

  const canSave = $derived(name.trim().length > 0 && name.trim().length <= 60);

  $effect(() => {
    if (!browser) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
    if (e.key === 'Enter' && canSave && !saving) submit();
  }

  function submit() {
    if (!canSave || saving) return;
    saving = true;
    onsave(name.trim());
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 flex items-center justify-center px-4"
  style="background: var(--color-overlay); backdrop-filter: blur(2px); z-index: var(--z-modal);"
  onclick={onclose}
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="w-full max-w-sm rounded-2xl p-6"
    style="background: var(--color-bg-card); border: 1px solid var(--color-border); box-shadow: var(--shadow-modal);"
    onclick={(e) => e.stopPropagation()}
  >
    <h2 class="mb-1 text-base font-bold" style="color: var(--color-text-primary);">
      Сохранить как шаблон
    </h2>
    <p class="mb-4 text-xs" style="color: var(--color-text-muted);">
      Текущая неделя будет сохранена для активной персоны
    </p>

    <label class="mb-1 block text-xs font-semibold" style="color: var(--color-text-primary);">
      Название шаблона
    </label>
    <input
      type="text"
      bind:value={name}
      maxlength={60}
      placeholder="Например: Летнее меню"
      autofocus
      class="mb-4 w-full rounded-lg px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border); background: var(--color-bg-input); color: var(--color-text-primary); outline: none;"
    />

    <div class="flex justify-end gap-2">
      <button
        type="button"
        onclick={onclose}
        class="rounded-lg px-4 py-2 text-sm font-semibold"
        style="border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted);"
      >
        Отмена
      </button>
      <button
        type="button"
        onclick={submit}
        disabled={!canSave || saving}
        class="rounded-lg px-4 py-2 text-sm font-semibold"
        style="background: var(--color-green-dark); color: var(--color-text-inverse); opacity: {!canSave || saving ? '0.5' : '1'};"
      >
        {saving ? 'Сохранение…' : 'Сохранить'}
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 4.2: Проверить TS**

```bash
pnpm check
```

Ожидаемый результат: 0 ошибок.

- [ ] **Step 4.3: Коммит**

```bash
git add src/lib/components/SaveTemplateModal.svelte
git commit -m "feat: V5-096 SaveTemplateModal"
```

---

## Task 5: ApplyTemplateModal

**Files:**
- Create: `src/lib/components/ApplyTemplateModal.svelte`

- [ ] **Step 5.1: Создать компонент**

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import type { MenuTemplate } from '$lib/types/database.js';

  type MergeMode = 'replace' | 'fill';

  interface Props {
    templates:  MenuTemplate[];
    userId:     string;
    onapply:    (template: MenuTemplate, mode: MergeMode) => void;
    ondelete:   (templateId: number) => void;
    onclose:    () => void;
  }

  let { templates, userId, onapply, ondelete, onclose }: Props = $props();

  let selectedId = $state<number | null>(templates[0]?.id ?? null);
  let mergeMode  = $state<MergeMode>('replace');
  let applying   = $state(false);

  const selectedTemplate = $derived(templates.find((t) => t.id === selectedId) ?? null);
  const canApply = $derived(selectedTemplate !== null && !applying);

  $effect(() => {
    if (!browser) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  function submit() {
    if (!canApply || !selectedTemplate) return;
    applying = true;
    onapply(selectedTemplate, mergeMode);
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 flex items-end justify-center sm:items-center px-0 sm:px-4"
  style="background: var(--color-overlay); backdrop-filter: blur(2px); z-index: var(--z-modal);"
  onclick={onclose}
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5"
    style="background: var(--color-bg-card); border: 1px solid var(--color-border); box-shadow: var(--shadow-modal);"
    onclick={(e) => e.stopPropagation()}
  >
    <h2 class="mb-4 text-base font-bold" style="color: var(--color-text-primary);">
      Применить шаблон
    </h2>

    {#if templates.length === 0}
      <p class="py-6 text-center text-sm" style="color: var(--color-text-muted);">
        Нет сохранённых шаблонов
      </p>
    {:else}
      <p class="mb-2 text-xs font-semibold" style="color: var(--color-text-primary);">Шаблон:</p>
      <div class="mb-4 flex max-h-48 flex-col gap-1.5 overflow-y-auto">
        {#each templates as t}
          <div
            class="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5"
            style="
              border: 1px solid {selectedId === t.id ? 'var(--color-green-tint-border)' : 'var(--color-border)'};
              background: {selectedId === t.id ? 'var(--color-green-tint)' : 'var(--color-bg-page)'};
            "
            role="button"
            tabindex="0"
            onclick={() => (selectedId = t.id)}
            onkeydown={(e) => { if (e.key === 'Enter') selectedId = t.id; }}
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold" style="color: var(--color-text-primary);">{t.name}</p>
              <p class="text-xs" style="color: var(--color-text-muted);">
                {t.slots.length} блюд · {formatDate(t.created_at)}
              </p>
            </div>
            {#if t.created_by === userId}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <button
                type="button"
                onclick={(e) => { e.stopPropagation(); ondelete(t.id); }}
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
                style="color: var(--color-text-muted);"
                aria-label="Удалить шаблон"
                onmouseenter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-error)'}
                onmouseleave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M6 6v4M8 6v4M3 3.5l.7 7a.5.5 0 0 0 .5.5h5.6a.5.5 0 0 0 .5-.5l.7-7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <p class="mb-2 text-xs font-semibold" style="color: var(--color-text-primary);">Режим применения:</p>
      <div class="mb-5 flex flex-col gap-1.5">
        <label class="flex cursor-pointer items-center gap-2 text-sm" style="color: var(--color-text-primary);">
          <input type="radio" bind:group={mergeMode} value="replace" class="accent-green-700" />
          <span><strong>Заменить</strong> — перезаписать текущее меню</span>
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-sm" style="color: var(--color-text-primary);">
          <input type="radio" bind:group={mergeMode} value="fill" class="accent-green-700" />
          <span><strong>Дополнить</strong> — только пустые слоты</span>
        </label>
      </div>
    {/if}

    <div class="flex justify-end gap-2">
      <button
        type="button"
        onclick={onclose}
        class="rounded-lg px-4 py-2 text-sm font-semibold"
        style="border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted);"
      >
        Отмена
      </button>
      {#if templates.length > 0}
        <button
          type="button"
          onclick={submit}
          disabled={!canApply}
          class="rounded-lg px-4 py-2 text-sm font-semibold"
          style="background: var(--color-green-dark); color: var(--color-text-inverse); opacity: {!canApply ? '0.5' : '1'};"
        >
          {applying ? 'Применяю…' : 'Применить'}
        </button>
      {/if}
    </div>
  </div>
</div>
```

- [ ] **Step 5.2: Проверить TS**

```bash
pnpm check
```

Ожидаемый результат: 0 ошибок.

- [ ] **Step 5.3: Коммит**

```bash
git add src/lib/components/ApplyTemplateModal.svelte
git commit -m "feat: V5-096 ApplyTemplateModal"
```

---

## Task 6: Интеграция в +page.svelte

**Files:**
- Modify: `src/routes/+page.svelte`

### Шаг 6.1 — импорты

- [ ] **Step 6.1: Добавить импорты** (в блок `<script>` рядом с другими импортами компонентов)

```ts
import SaveTemplateModal from '$lib/components/SaveTemplateModal.svelte';
import ApplyTemplateModal from '$lib/components/ApplyTemplateModal.svelte';
import type { MenuTemplate, TemplateSlot } from '$lib/types/database.js';
```

### Шаг 6.2 — стейт

- [ ] **Step 6.2: Добавить реактивный стейт** (рядом со стейтом `fridgeModalOpen` и `splitDropOpen`)

```ts
let saveTemplateOpen  = $state(false);
let applyTemplateOpen = $state(false);

// Локальная копия шаблонов для оптимистичного удаления
let localTemplates = $state<MenuTemplate[]>(
  (data.menuTemplates ?? []) as MenuTemplate[]
);

// Синхронизация при обновлении page data
$effect(() => {
  localTemplates = (data.menuTemplates ?? []) as MenuTemplate[];
});
```

### Шаг 6.3 — функции

- [ ] **Step 6.3: Добавить три функции** (после функции `handleFridgeGenerate`)

```ts
async function handleSaveTemplate(name: string) {
  if (!activePersona) return;
  const slots: TemplateSlot[] = [];
  for (const [key, rows] of localPlans) {
    if (!key.startsWith(`${activePersona.id}__${weekId}__`)) continue;
    for (const r of rows) {
      slots.push({
        day_index:     r.day_index,
        meal_key:      r.meal_key,
        dish_name:     r.dish_name,
        dish_photo:    r.dish_photo,
        dish_category: r.dish_category,
        kcal:          r.kcal,
        protein:       r.protein,
        fat:           r.fat,
        carbs:         r.carbs,
        cost:          r.cost,
        grams:         r.grams,
        sort_order:    r.sort_order,
      });
    }
  }
  // page.data.householdId — активное хозяйство (то, что проверяет RLS)
  const householdId = page.data.householdId as string | null;
  const userId = page.data.user?.id;
  if (!householdId || !userId) return;

  const { data: inserted, error } = await page.data.supabase
    .from('menu_templates')
    .insert({ household_id: householdId, created_by: userId, name, slots })
    .select()
    .single();

  saveTemplateOpen = false;
  if (error || !inserted) {
    showErrorToast('Не удалось сохранить шаблон');
    return;
  }
  localTemplates = [inserted as MenuTemplate, ...localTemplates];
  showToast(`Шаблон «${name}» сохранён`, []);
}

async function handleApplyTemplate(
  template: MenuTemplate,
  mode: 'replace' | 'fill'
) {
  if (!activePersona) return;
  applyTemplateOpen = false;

  const slots = template.slots;
  const persona = activePersona;
  const snapshot = new Map(localPlans);

  const rowsToInsert =
    mode === 'fill'
      ? slots.filter((s) => {
          const k = slotKey(persona.id, weekId, s.day_index, s.meal_key as MealKey);
          return (localPlans.get(k) ?? []).length === 0;
        })
      : slots;

  if (rowsToInsert.length === 0) {
    showToast('Все слоты уже заполнены', []);
    return;
  }

  if (mode === 'replace') {
    await page.data.supabase
      .from('menu_plans')
      .delete()
      .eq('persona_id', persona.id)
      .eq('week_label', weekId);
  }

  const inserts = rowsToInsert.map((s) => ({
    persona_id:    persona.id,
    week_label:    weekId,
    day_index:     s.day_index,
    meal_key:      s.meal_key,
    dish_name:     s.dish_name,
    dish_photo:    s.dish_photo,
    dish_category: s.dish_category,
    kcal:          s.kcal,
    protein:       s.protein,
    fat:           s.fat,
    carbs:         s.carbs,
    cost:          s.cost,
    grams:         s.grams,
    sort_order:    s.sort_order,
  }));

  const { data: inserted } = await page.data.supabase
    .from('menu_plans')
    .insert(inserts)
    .select('id, day_index, meal_key, dish_name, sort_order');

  if (!inserted || inserted.length === 0) {
    localPlans = snapshot;
    showErrorToast('Ошибка при применении шаблона');
    return;
  }

  const next = new Map(localPlans);
  if (mode === 'replace') {
    for (const [k] of next) {
      if (k.startsWith(`${persona.id}__${weekId}__`)) next.delete(k);
    }
  }

  const usedIndices = new Map<string, number>();
  for (const row of inserted) {
    const groupKey = `${row.day_index}__${row.meal_key}__${row.dish_name}`;
    const usedCount = usedIndices.get(groupKey) ?? 0;
    const candidates = rowsToInsert.filter(
      (s) =>
        s.day_index === row.day_index &&
        s.meal_key === row.meal_key &&
        s.dish_name === row.dish_name
    );
    const src = candidates[usedCount];
    usedIndices.set(groupKey, usedCount + 1);
    if (!src) continue;
    const k = slotKey(persona.id, weekId, row.day_index, row.meal_key as MealKey);
    const arr = next.get(k) ?? [];
    arr.push({
      id:            row.id,
      persona_id:    persona.id,
      week_label:    weekId,
      day_index:     src.day_index,
      meal_key:      src.meal_key,
      dish_name:     src.dish_name,
      dish_photo:    src.dish_photo,
      dish_category: src.dish_category,
      kcal:          src.kcal,
      protein:       src.protein,
      fat:           src.fat,
      carbs:         src.carbs,
      cost:          src.cost,
      grams:         src.grams,
      sort_order:    src.sort_order,
    });
    next.set(k, arr);
  }
  localPlans = next;
  const modeLabel = mode === 'fill' ? 'дополнено' : 'применено';
  showToast(
    `Шаблон «${template.name}» ${modeLabel}`,
    inserted.map((r: { id: number }) => r.id)
  );
}

async function handleDeleteTemplate(templateId: number) {
  localTemplates = localTemplates.filter((t) => t.id !== templateId);
  await page.data.supabase.from('menu_templates').delete().eq('id', templateId);
}
```

### Шаг 6.4 — пункты в dropdown

- [ ] **Step 6.4: Добавить два новых пункта в split-dropdown** (в шаблоне, после существующего пункта «🧊 С учётом холодильника…», строка ~1504)

Найти в шаблоне блок:
```html
							🧊 С учётом холодильника…
							</button>
						</div>
					{/if}
```

Заменить на:
```html
							🧊 С учётом холодильника…
							</button>
							<div style="height: 1px; background: var(--color-border); margin: 4px 0;"></div>
							<button
								onclick={() => { splitDropOpen = false; saveTemplateOpen = true; }}
								disabled={!hasPlansThisWeek()}
								class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors"
								style="color: {hasPlansThisWeek() ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}; opacity: {hasPlansThisWeek() ? '1' : '0.5'};"
								onmouseenter={(e) => { if (hasPlansThisWeek()) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'; }}
								onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
							>
								📋 Сохранить как шаблон
							</button>
							<button
								onclick={() => { splitDropOpen = false; applyTemplateOpen = true; }}
								disabled={localTemplates.length === 0}
								class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors"
								style="color: {localTemplates.length > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}; opacity: {localTemplates.length > 0 ? '1' : '0.5'};"
								onmouseenter={(e) => { if (localTemplates.length > 0) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'; }}
								onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
							>
								✨ Применить шаблон…
							</button>
						</div>
					{/if}
```

### Шаг 6.5 — рендер модалок

- [ ] **Step 6.5: Добавить рендер модалок** (в конце шаблона, рядом с другими модалками, после `<FridgeSelectModal ...>`)

```svelte
{#if saveTemplateOpen && activePersona}
  <SaveTemplateModal
    onsave={handleSaveTemplate}
    onclose={() => (saveTemplateOpen = false)}
  />
{/if}

{#if applyTemplateOpen}
  <ApplyTemplateModal
    templates={localTemplates}
    userId={page.data.user?.id ?? ''}
    onapply={handleApplyTemplate}
    ondelete={handleDeleteTemplate}
    onclose={() => (applyTemplateOpen = false)}
  />
{/if}
```

- [ ] **Step 6.6: Проверить TS**

```bash
pnpm check
```

Ожидаемый результат: 0 ошибок.

- [ ] **Step 6.7: Коммит**

```bash
git add src/routes/+page.svelte
git commit -m "feat: V5-096 интеграция шаблонов в планировщик"
```

---

## Task 7: Ручное тестирование

- [ ] **Step 7.1: Запустить дев-сервер**

```bash
pnpm dev
```

Открыть http://localhost:5173

- [ ] **Step 7.2: Тест сохранения**

1. Открыть планировщик, убедиться что на текущей неделе есть блюда
2. Нажать стрелку ▾ рядом с «Сгенерировать»
3. Нажать «📋 Сохранить как шаблон»
4. Ввести имя «Тест», нажать «Сохранить»
5. Ожидать: тост «Шаблон «Тест» сохранён», модалка закрывается
6. Пункт «✨ Применить шаблон…» должен стать активным

- [ ] **Step 7.3: Тест применения (заменить)**

1. Перейти на следующую неделю (→)
2. Открыть dropdown → «✨ Применить шаблон…»
3. Выбрать шаблон «Тест», режим «Заменить», нажать «Применить»
4. Ожидать: блюда шаблона появились в сетке, тост «применено»

- [ ] **Step 7.4: Тест применения (дополнить)**

1. Вручную добавить блюдо в понедельник-завтрак
2. Применить шаблон с режимом «Дополнить»
3. Ожидать: понедельник-завтрак не перезаписан, остальные пустые слоты заполнены

- [ ] **Step 7.5: Тест удаления**

1. Открыть «Применить шаблон…»
2. Нажать 🗑 рядом с шаблоном «Тест»
3. Ожидать: шаблон исчезает из списка

- [ ] **Step 7.6: Финальный коммит и обновление бэклога**

Обновить `docs/backlog.md` — поменять статус V5-096 на `✔️ готово` и указать дату 2026-05-05.

```bash
git add docs/backlog.md
git commit -m "docs: V5-096 шаблоны меню отмечено как готово"
```

---

## Проверочный список (spec coverage)

| Требование из спека | Задача |
|---|---|
| Новая таблица `menu_templates` с RLS | Task 1 |
| Типы `MenuTemplate`, `TemplateSlot` в database.ts | Task 2 |
| Загрузка шаблонов в `+page.server.ts` | Task 3 |
| `SaveTemplateModal` с полем имени | Task 4 |
| `ApplyTemplateModal` со списком и режимами | Task 5 |
| Пункты в split-dropdown | Task 6.4 |
| Рендер модалок | Task 6.5 |
| Удаление шаблона только создателем | Task 5 (кнопка 🗑 видна только `created_by === userId`) + RLS |
| «Только пустые» — слот пуст если нет строк | Task 6.3 (`fill` фильтрация) |
| `canEdit` — применение только к своим персонам | Inherited: dropdown показывается только при `canEdit` |
