# V5-097: Генерация меню с учётом холодильника — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить режим генерации меню, который приоритизирует блюда, содержащие выбранные пользователем продукты из холодильника.

**Architecture:** Три шага: (1) расширить генератор — добавить тип `FridgeHint` и функцию `buildFridgeHints`, изменить `pickDish` для приоритизации; (2) создать компонент диалога выбора продуктов `FridgeSelectModal.svelte`; (3) в `+page.svelte` заменить кнопку «Сгенерировать» на split-кнопку и подключить весь flow.

**Tech Stack:** SvelteKit 2 + Svelte 5 Runes (`$state`, `$derived`, `$props`) · TypeScript strict · Tailwind CSS v4 + CSS vars

---

## Файловая карта

| Файл | Действие | Ответственность |
|---|---|---|
| `src/lib/utils/generate.ts` | Modify | `FridgeHint` тип, `buildFridgeHints`, изменить `pickDish` и `GenerateOptions` |
| `src/lib/components/FridgeSelectModal.svelte` | Create | Диалог выбора продуктов из холодильника |
| `src/routes/+page.svelte` | Modify | Split-кнопка, подключение `FridgeSelectModal`, передача hints в `runGenerate` |

---

## Task 1: FridgeHint + buildFridgeHints + pickDish в generate.ts

**Files:**
- Modify: `src/lib/utils/generate.ts`

### Контекст

`generate.ts` уже содержит:
- `interface GenerateOptions` с полями `kcal_target`, `meal_ratios`, `carry_dinner_to_lunch`, `match_kcal`, `customDishes?`, `foodCatalog?`
- `function pickDish(dishes, target, excludeIds, matchKcal): Dish` — выбирает блюдо из пула
- `export function generateWeekPlan(opts: GenerateOptions): GeneratedSlot[]`
- `export function customToDish(cd: CustomDish, idx: number): Dish`

`Dish` (из `src/lib/types/dish.ts`) имеет поле `ingredients: DishIngredient[]` где `DishIngredient = { name: string; category: ShoppingCategory; qty?: number; unit?: string }`.

`FridgeRow` (из `src/lib/types/database.ts`):
```ts
interface FridgeRow {
  id: number;
  household_id: string;
  product_name: string;
  qty: number;
  unit: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 1: Добавить интерфейс FridgeHint и тип SelectedFridgeProduct**

В начало файла `src/lib/utils/generate.ts`, после существующих импортов, добавить:

```ts
import type { FridgeRow } from '$lib/types/database.js';

export interface FridgeHint {
  dishIds:   Set<number>;
  slotsLeft: number;
}
```

`FridgeRow` уже экспортируется из `database.ts` — просто импортируем.

- [ ] **Step 2: Добавить поле fridgeHints в GenerateOptions**

Изменить интерфейс `GenerateOptions`:

```ts
interface GenerateOptions {
  kcal_target:           number;
  meal_ratios:           { bf: number; ln: number; dn: number };
  carry_dinner_to_lunch: boolean;
  match_kcal:            boolean;
  customDishes?:         CustomDish[];
  foodCatalog?:          Dish[];
  fridgeHints?:          FridgeHint[];
}
```

- [ ] **Step 3: Добавить функцию buildFridgeHints**

После функции `customToDish` добавить:

```ts
const FRIDGE_FALLBACK_PORTION_G = 150;

export function buildFridgeHints(
  selected: FridgeRow[],
  catalog:  Dish[],
): FridgeHint[] {
  const hints: FridgeHint[] = [];

  for (const item of selected) {
    const nameLower = item.product_name.toLowerCase().trim();

    const matched = catalog.filter(dish =>
      dish.ingredients.some(ing => ing.name.toLowerCase().includes(nameLower))
    );
    if (matched.length === 0) continue;

    // Нормализуем qty к граммам
    let qtyG = item.qty;
    if (item.unit === 'кг') qtyG = item.qty * 1000;
    else if (item.unit !== 'г') qtyG = FRIDGE_FALLBACK_PORTION_G; // шт, л, мл → фолбэк

    // Берём порцию из ingredient.qty первого совпавшего блюда с qty > 0
    let portionG = FRIDGE_FALLBACK_PORTION_G;
    for (const dish of matched) {
      const ing = dish.ingredients.find(i => i.name.toLowerCase().includes(nameLower) && (i.qty ?? 0) > 0);
      if (ing?.qty) { portionG = ing.qty; break; }
    }

    const budget = Math.min(Math.floor(qtyG / portionG), 7);
    if (budget <= 0) continue;

    hints.push({
      dishIds:   new Set(matched.map(d => d.id)),
      slotsLeft: budget,
    });
  }

  return hints;
}
```

- [ ] **Step 4: Изменить сигнатуру pickDish — добавить параметр hints**

Заменить текущую функцию `pickDish`:

```ts
function pickDish(
  dishes:     Dish[],
  target:     number,
  excludeIds: number[],
  matchKcal:  boolean,
  hints?:     FridgeHint[],
): Dish {
  const pool = dishes.length > excludeIds.length
    ? dishes.filter(d => !excludeIds.includes(d.id))
    : dishes;

  // Приоритет: блюда из активных hints
  if (hints) {
    const activeHints = hints.filter(h => h.slotsLeft > 0);
    const hintPool = pool.filter(d => activeHints.some(h => h.dishIds.has(d.id)));
    if (hintPool.length > 0) {
      const picked = matchKcal
        ? (() => {
            const sorted = [...hintPool].sort((a, b) =>
              Math.abs(a.kcal_per_100g - target) - Math.abs(b.kcal_per_100g - target)
            );
            const top = sorted.slice(0, Math.min(3, sorted.length));
            return top[Math.floor(Math.random() * top.length)];
          })()
        : hintPool[Math.floor(Math.random() * hintPool.length)];

      // Уменьшаем slotsLeft у всех hints, чьи dishIds включают picked
      for (const h of activeHints) {
        if (h.dishIds.has(picked.id)) h.slotsLeft--;
      }
      return picked;
    }
  }

  if (!matchKcal) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const sorted = [...pool].sort((a, b) =>
    Math.abs(a.kcal_per_100g - target) - Math.abs(b.kcal_per_100g - target)
  );
  const top = sorted.slice(0, Math.min(3, sorted.length));
  return top[Math.floor(Math.random() * top.length)];
}
```

- [ ] **Step 5: Передавать hints во все вызовы pickDish внутри generateWeekPlan**

В `generateWeekPlan` деструктурировать `fridgeHints`:

```ts
export function generateWeekPlan(opts: GenerateOptions): GeneratedSlot[] {
  const { kcal_target, meal_ratios, carry_dinner_to_lunch, match_kcal, customDishes = [], foodCatalog = [], fridgeHints } = opts;
  // ... остальной код без изменений ...
```

Затем во всех вызовах `pickDish` добавить последним аргументом `fridgeHints`:

```ts
// Завтрак
const dish1 = pickDish(dishesByCat.breakfast, kcal_bf * 0.7, prevIds, match_kcal, fridgeHints);
// ...
const dish2 = pickDish(dishesByCat.breakfast, remaining, [dish1.id], match_kcal, fridgeHints);

// Обед (carry branch)
const saladDish = pickDish(dishesByCat.salad, Math.round(kcal_ln * 0.20), prevSalad, match_kcal, fridgeHints);
// buildMealSlots не вызывает pickDish напрямую — нужно изменить его сигнатуру

// Обед (else branch)
const mainDish = pickDish(dishesByCat.main, Math.round(kcal_ln * 0.45), prevMain, match_kcal, fridgeHints);
// ... sideDish, saladDish аналогично

// Ужин — через buildMealSlots
// Перекус
const dish1 = pickDish(dishesByCat.snack, kcal_sn, prevIds, match_kcal, fridgeHints);
const dish2 = pickDish(dishesByCat.snack, kcal_sn - s1.kcal, [dish1.id], match_kcal, fridgeHints);
```

Также нужно изменить `buildMealSlots` чтобы она принимала и передавала hints:

```ts
function buildMealSlots(
  dayIndex:    number,
  mealKey:     MealKey,
  slotKcal:    number,
  components:  Array<{ category: DishCategory; ratio: number }>,
  prevIds:     Record<DishCategory, number[]>,
  matchKcal:   boolean,
  slots:       GeneratedSlot[],
  dishesByCat: Record<DishCategory, Dish[]>,
  hints?:      FridgeHint[],
) {
  for (const comp of components) {
    const targetKcal = Math.round(slotKcal * comp.ratio);
    const dish = pickDish(dishesByCat[comp.category], targetKcal, prevIds[comp.category] ?? [], matchKcal, hints);
    const scaled = scaleDish(dish, targetKcal);
    slots.push({ day_index: dayIndex, meal_key: mealKey, ...scaled });
  }
}
```

И передавать `fridgeHints` в вызовы `buildMealSlots`:

```ts
buildMealSlots(day, 'ln', kcal_ln, [...], {...}, match_kcal, slots, dishesByCat, fridgeHints);
// ужин:
buildMealSlots(day, 'dn', kcal_dn, [...], {...}, match_kcal, slots, dishesByCat, fridgeHints);
```

- [ ] **Step 6: Проверить типы**

```bash
cd d:/sites/Planmeal-v5 && pnpm check 2>&1 | head -40
```

Ожидание: ошибки только если где-то пропустили аргумент `hints`. Исправить все.

- [ ] **Step 7: Commit**

```bash
git add src/lib/utils/generate.ts
git commit -m "feat: V5-097 buildFridgeHints + pickDish приоритет холодильника"
```

---

## Task 2: Компонент FridgeSelectModal.svelte

**Files:**
- Create: `src/lib/components/FridgeSelectModal.svelte`

### Контекст

Компонент получает список продуктов холодильника, показывает чекбоксы, кнопки «Выбрать все» / «Снять все», и по клику на «Сгенерировать» вызывает `ongenerate(selected)`. CSS-токены: `--color-bg-card`, `--color-bg-surface`, `--color-border`, `--color-text-primary`, `--color-text-muted`, `--color-green-dark`, `--color-green-primary`, `--color-overlay`, `--z-modal`, `--radius-xl`, `--shadow-modal`. Смотри как устроены другие модалки — например `SmartReplaceModal.svelte`.

`FridgeRow` импортируем из `$lib/types/database.js`.

- [ ] **Step 1: Создать файл с базовой структурой**

Создать `src/lib/components/FridgeSelectModal.svelte`:

```svelte
<script lang="ts">
  import type { FridgeRow } from '$lib/types/database.js';

  interface Props {
    fridgeItems: FridgeRow[];
    ongenerate:  (selected: FridgeRow[]) => void;
    onclose:     () => void;
  }

  const { fridgeItems, ongenerate, onclose }: Props = $props();

  // По умолчанию — все выбраны
  let selectedIds = $state(new Set<number>(fridgeItems.map(f => f.id)));

  const count    = $derived(selectedIds.size);
  const allOn    = $derived(count === fridgeItems.length);
  const canSubmit = $derived(count > 0);

  function toggle(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedIds = next;
  }

  function selectAll()  { selectedIds = new Set(fridgeItems.map(f => f.id)); }
  function deselectAll() { selectedIds = new Set(); }

  function submit() {
    const selected = fridgeItems.filter(f => selectedIds.has(f.id));
    ongenerate(selected);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 flex items-center justify-center px-4"
  style="background: var(--color-overlay); z-index: var(--z-modal);"
  onclick={onclose}
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="modal-enter w-full max-w-sm"
    style="background: var(--color-bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-modal); overflow: hidden;"
    onclick={(e) => e.stopPropagation()}
  >

    <!-- Шапка -->
    <div class="flex items-center justify-between px-5 py-4" style="border-bottom: 1px solid var(--color-border);">
      <div>
        <div class="font-semibold" style="color: var(--color-text-primary);">Продукты из холодильника</div>
        <div class="text-xs mt-0.5" style="color: var(--color-text-muted);">Выберите, что учитывать при генерации</div>
      </div>
      <button onclick={onclose} class="p-1 rounded" style="color: var(--color-text-muted);" aria-label="Закрыть">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Выбрать все / Снять все -->
    <div class="flex items-center gap-2 px-5 py-2.5" style="border-bottom: 1px solid var(--color-border);">
      <button
        onclick={selectAll}
        class="text-xs px-3 py-1 rounded-md transition-colors"
        style="background: var(--color-bg-surface); color: {allOn ? 'var(--color-green-dark)' : 'var(--color-text-muted)'}; border: 1px solid {allOn ? 'var(--color-green-dark)' : 'var(--color-border)'};"
      >Выбрать все</button>
      <button
        onclick={deselectAll}
        class="text-xs px-3 py-1 rounded-md transition-colors"
        style="background: var(--color-bg-surface); color: var(--color-text-muted); border: 1px solid var(--color-border);"
      >Снять все</button>
      <span class="ml-auto text-xs" style="color: var(--color-text-muted);">{count} из {fridgeItems.length}</span>
    </div>

    <!-- Список продуктов -->
    <div class="overflow-y-auto" style="max-height: 280px; padding: 8px 12px;">
      {#each fridgeItems as item (item.id)}
        {@const checked = selectedIds.has(item.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
          class="flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer mb-1 transition-colors"
          style="background: {checked ? 'color-mix(in srgb, var(--color-green-dark) 12%, transparent)' : 'transparent'};"
          onclick={() => toggle(item.id)}
        >
          <!-- Чекбокс -->
          <div
            class="flex-shrink-0 rounded flex items-center justify-center"
            style="width: 16px; height: 16px; background: {checked ? 'var(--color-green-dark)' : 'transparent'}; border: 1.5px solid {checked ? 'var(--color-green-dark)' : 'var(--color-border)'};"
          >
            {#if checked}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2.5 2.5L8 3" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {/if}
          </div>

          <span class="flex-1 text-sm" style="color: {checked ? 'var(--color-text-primary)' : 'var(--color-text-muted)'};">
            {item.product_name}
          </span>
          <span class="text-xs" style="color: var(--color-text-muted);">
            {item.qty} {item.unit}
          </span>
        </div>
      {/each}
    </div>

    <!-- Кнопка генерации -->
    <div class="px-5 py-4" style="border-top: 1px solid var(--color-border);">
      <button
        onclick={submit}
        disabled={!canSubmit}
        class="w-full rounded-lg py-2.5 text-sm font-semibold transition-colors"
        style="background: {canSubmit ? 'var(--color-green-dark)' : 'var(--color-bg-surface)'}; color: {canSubmit ? 'var(--color-text-inverse)' : 'var(--color-text-muted)'};"
      >
        {#if canSubmit}
          ⚡ Сгенерировать с {count} {count === 1 ? 'продуктом' : count < 5 ? 'продуктами' : 'продуктами'}
        {:else}
          Выберите хотя бы один продукт
        {/if}
      </button>
    </div>

  </div>
</div>
```

- [ ] **Step 2: Проверить типы**

```bash
cd d:/sites/Planmeal-v5 && pnpm check 2>&1 | head -40
```

Ожидание: нет ошибок по новому файлу.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/FridgeSelectModal.svelte
git commit -m "feat: V5-097 FridgeSelectModal — выбор продуктов из холодильника"
```

---

## Task 3: Split-кнопка и flow в +page.svelte

**Files:**
- Modify: `src/routes/+page.svelte`

### Контекст

Текущая кнопка «Сгенерировать» находится в блоке `{#if canEdit}` около строки 1408–1444. `handleGenerate()` вызывает `showGenConfirm = true` если есть планы, иначе `runGenerate()`. `runGenerate()` вызывает `generateWeekPlan(opts)` и сохраняет в Supabase.

Нужно:
1. Добавить импорты: `FridgeSelectModal`, `buildFridgeHints`, `FridgeRow`
2. Добавить state: `fridgeModalOpen`, dropdown open state
3. Заменить кнопку на split-кнопку
4. Изменить `runGenerate` чтобы принимала опциональные `fridgeHints`
5. Добавить `handleFridgeGenerate` — вызывается из FridgeSelectModal
6. Добавить `{#if fridgeModalOpen}` блок с FridgeSelectModal

- [ ] **Step 1: Добавить импорты**

В блок импортов `<script>` (после строки `import SmartReplaceModal from '$lib/components/SmartReplaceModal.svelte';`) добавить:

```ts
import FridgeSelectModal from '$lib/components/FridgeSelectModal.svelte';
import { buildFridgeHints } from '$lib/utils/generate.js';
import type { FridgeRow } from '$lib/types/database.js';
```

- [ ] **Step 2: Добавить state переменные**

После `let smartReplacePlan = $state<MenuPlanRow | null>(null);` добавить:

```ts
let fridgeModalOpen  = $state(false);
let splitDropOpen    = $state(false);

const fridgeItems = $derived((page.data.fridgeItems ?? []) as FridgeRow[]);
const hasFridge   = $derived(fridgeItems.length > 0);
```

- [ ] **Step 3: Изменить runGenerate — принять fridgeHints**

Изменить только сигнатуру функции и добавить `fridgeHints` в opts. `generateWeekPlan` уже сам вызывает `customToDish` внутри — пересобирать каталог здесь не нужно.

```ts
async function runGenerate(fridgeHints?: import('$lib/utils/generate.js').FridgeHint[]) {
  showGenConfirm = false;
  await tick();

  const persona = activePersona;
  if (!persona) return;

  generating = true;
  try {
    const slots = generateWeekPlan({
      kcal_target: persona.kcal_target ?? 2000,
      meal_ratios: persona.meal_ratios as { bf: number; ln: number; dn: number },
      carry_dinner_to_lunch: (page.data.household as import('$lib/types/database.js').Household | null)?.carry_dinner_to_lunch ?? true,
      match_kcal: persona.match_kcal ?? true,
      customDishes: (page.data.customDishes ?? []) as import('$lib/types/database.js').CustomDish[],
      foodCatalog: (page.data.foodCatalog ?? []) as Dish[],
      fridgeHints,
    });
    // ... остальное тело без изменений
```

Обновить импорт `generate.js`:

```ts
import { generateWeekPlan, buildFridgeHints, customToDish } from '$lib/utils/generate.js';
```

- [ ] **Step 4: Добавить handleFridgeGenerate**

После `handleGenerate` добавить:

```ts
function handleFridgeGenerate(selected: FridgeRow[]) {
  fridgeModalOpen = false;
  splitDropOpen   = false;

  const allDishes: Dish[] = [
    ...(page.data.foodCatalog ?? []) as Dish[],
    ...((page.data.customDishes ?? []) as import('$lib/types/database.js').CustomDish[])
      .map((cd, i) => customToDish(cd, i)),
  ];

  const hints = buildFridgeHints(selected, allDishes);
  runGenerate(hints);
}
```

- [ ] **Step 5: Заменить кнопку на split-кнопку**

Найти блок (≈ строка 1407–1445):
```svelte
<!-- Кнопка генерации -->
{#if canEdit}
<button
  onclick={handleGenerate}
  ...
>
  ...Сгенерировать...
</button>
{/if}
```

Заменить на:

```svelte
<!-- Кнопка генерации (split) -->
{#if canEdit}
<div class="relative flex" style="gap: 2px;">
  <!-- Основная кнопка — обычная генерация -->
  <button
    onclick={handleGenerate}
    disabled={generating || !activePersona}
    class="flex items-center gap-1.5 rounded-lg rounded-r-none px-3 py-1.5 text-xs font-semibold transition-all"
    style="background: var(--color-green-dark); color: var(--color-text-inverse); letter-spacing: 0.02em; opacity: {generating ? '0.6' : '1'};"
    onmouseenter={(e) => { if (!generating) (e.currentTarget as HTMLElement).style.background = 'var(--color-green-primary)'; }}
    onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-green-dark)'; }}
    aria-label="Сгенерировать меню"
  >
    {#if generating}
      <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
      Генерирую...
    {:else}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.93 2.93l1.41 1.41M7.66 7.66l1.41 1.41M2.93 9.07l1.41-1.41M7.66 4.34l1.41-1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      Сгенерировать
    {/if}
  </button>

  <!-- Стрелка-дропдаун -->
  <button
    onclick={() => (splitDropOpen = !splitDropOpen)}
    disabled={generating || !activePersona}
    class="flex items-center px-2 py-1.5 rounded-lg rounded-l-none text-xs font-semibold transition-all"
    style="background: var(--color-green-dark); color: var(--color-text-inverse); opacity: {generating ? '0.6' : '1'}; border-left: 1px solid color-mix(in srgb, white 20%, transparent);"
    aria-label="Дополнительные варианты генерации"
  >
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>

  <!-- Дропдаун-меню -->
  {#if splitDropOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0"
      style="z-index: 10;"
      onclick={() => (splitDropOpen = false)}
    ></div>
    <div
      class="absolute top-full mt-1 right-0 rounded-lg overflow-hidden"
      style="background: var(--color-bg-card); border: 1px solid var(--color-border); box-shadow: var(--shadow-modal); z-index: 20; min-width: 200px;"
    >
      <button
        onclick={() => { splitDropOpen = false; handleGenerate(); }}
        class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors"
        style="color: var(--color-text-primary);"
        onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'}
        onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
      >
        🎲 Сгенерировать случайно
      </button>
      <button
        onclick={() => { splitDropOpen = false; if (hasFridge) fridgeModalOpen = true; }}
        disabled={!hasFridge}
        class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors"
        style="color: {hasFridge ? 'var(--color-green-dark)' : 'var(--color-text-muted)'}; opacity: {hasFridge ? '1' : '0.5'};"
        onmouseenter={(e) => { if (hasFridge) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)'; }}
        onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
      >
        🧊 С учётом холодильника…
      </button>
    </div>
  {/if}
</div>
{/if}
```

- [ ] **Step 6: Добавить FridgeSelectModal в шаблон**

В конце файла, перед закрывающим `</svelte:head>` или рядом с блоком `{#if smartReplacePlan}`, добавить:

```svelte
{#if fridgeModalOpen}
  <FridgeSelectModal
    fridgeItems={fridgeItems}
    ongenerate={handleFridgeGenerate}
    onclose={() => (fridgeModalOpen = false)}
  />
{/if}
```

- [ ] **Step 7: Проверить типы**

```bash
cd d:/sites/Planmeal-v5 && pnpm check 2>&1 | head -50
```

Ожидание: 0 ошибок.

- [ ] **Step 8: Lint**

```bash
cd d:/sites/Planmeal-v5 && pnpm lint 2>&1 | head -30
```

- [ ] **Step 9: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: V5-097 split-кнопка генерации + FridgeSelectModal wiring"
```

---

## Task 4: Обновить бэклог

**Files:**
- Modify: `docs/backlog.md`

- [ ] **Step 1: Отметить V5-097 как готово**

В `docs/backlog.md` найти строку:
```
| V5-097 | Генерация меню с учётом остатков в холодильнике | 📋 не начато | — | — |
```

Заменить на:
```
| V5-097 | Генерация меню с учётом остатков в холодильнике | ✔️ готово | 2026-04-22 | — |
```

- [ ] **Step 2: Commit**

```bash
git add docs/backlog.md
git commit -m "docs: V5-097 отмечено как готово"
```
