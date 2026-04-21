# V5-095 Умная замена блюда — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Когда пользователь нажимает «Заменить» на блюде, вместо полного каталога открывается модал с топ-5 похожими блюдами (по соотношению БЖУ + категории), отдельной группой кастомных блюд и кнопками «Показать ещё» / «Выбрать вручную».

**Architecture:** Новая функция `findSimilarDishes()` в `generate.ts` считает score совпадения по соотношениям макронутриентов. Новый компонент `SmartReplaceModal.svelte` показывает результаты и управляет пагинацией. В `+page.svelte` `handleDetailReplace` открывает SmartReplaceModal вместо MealModal; при выборе блюда — та же логика `handleSelect`.

**Tech Stack:** SvelteKit 2 · Svelte 5 Runes (`$state`, `$derived`, `$props`) · TypeScript strict · существующий `scaleDish()` из `generate.ts`

---

## Файлы

| Файл | Действие |
|------|----------|
| `src/lib/utils/generate.ts` | Экспортировать `scaleDish`, добавить `findSimilarDishes` + тип `SimilarDish` |
| `src/lib/components/SmartReplaceModal.svelte` | Создать новый компонент |
| `src/routes/+page.svelte` | Импортировать SmartReplaceModal, добавить state + template, изменить `handleDetailReplace` |

---

## Task 1: `findSimilarDishes` + экспорт `scaleDish`

**Files:**
- Modify: `src/lib/utils/generate.ts`

- [ ] **Шаг 1: Экспортировать `scaleDish`**

В `src/lib/utils/generate.ts` найти строку:
```ts
function scaleDish(dish: Dish, target_kcal: number): Omit<GeneratedSlot, 'day_index' | 'meal_key'> {
```
Заменить на:
```ts
export function scaleDish(dish: Dish, target_kcal: number): Omit<GeneratedSlot, 'day_index' | 'meal_key'> {
```

- [ ] **Шаг 2: Добавить тип `SimilarDish` и функцию `findSimilarDishes` в конец файла**

```ts
export interface SimilarDish {
  dish:  Dish;
  score: number; // 0–100
}

/**
 * Подбирает блюда той же категории по близости соотношений БЖУ.
 * source.kcal/protein/fat/carbs — значения в любых единицах (соотношения инвариантны к масштабу).
 */
export function findSimilarDishes(
  source: { kcal: number; protein: number; fat: number; carbs: number; category: string; id?: number },
  catalog: Dish[],
): SimilarDish[] {
  const k = source.kcal || 1;
  const srcPR = (source.protein * 4) / k;
  const srcFR = (source.fat     * 9) / k;
  const srcCR = (source.carbs   * 4) / k;

  return catalog
    .filter(d => d.category === source.category && d.id !== source.id)
    .map(d => {
      const dk   = d.kcal_per_100g || 1;
      const dPR  = (d.protein_per_100g * 4) / dk;
      const dFR  = (d.fat_per_100g     * 9) / dk;
      const dCR  = (d.carbs_per_100g   * 4) / dk;
      const kcalDelta = Math.abs(dk - source.kcal / (source.kcal / 100)) / dk; // ≈ 0 если kcal похожи
      // Взвешенная сумма отклонений соотношений + ккал
      const diff = Math.abs(dPR - srcPR) * 0.4
                 + Math.abs(dFR - srcFR) * 0.3
                 + Math.abs(dCR - srcCR) * 0.2
                 + Math.abs(d.kcal_per_100g - source.kcal) / (source.kcal || 1) * 0.1;
      return { dish: d, score: Math.max(0, Math.round((1 - diff * 2.5) * 100)) };
    })
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Шаг 3: Проверить TypeScript**

```
pnpm check
```
Ожидаемый результат: 0 errors.

- [ ] **Шаг 4: Коммит**

```bash
git add src/lib/utils/generate.ts
git commit -m "feat: export scaleDish, add findSimilarDishes to generate.ts"
```

---

## Task 2: Компонент `SmartReplaceModal.svelte`

**Files:**
- Create: `src/lib/components/SmartReplaceModal.svelte`

- [ ] **Шаг 1: Создать файл**

`src/lib/components/SmartReplaceModal.svelte`:

```svelte
<script lang="ts">
  import type { Dish } from '$lib/types/dish.js';
  import type { CustomDish, MenuPlan } from '$lib/types/database.js';
  import { findSimilarDishes, scaleDish } from '$lib/utils/generate.js';
  import type { SimilarDish } from '$lib/utils/generate.js';

  interface Props {
    sourcePlan:   MenuPlan;
    catalog:      Dish[];
    customDishes: CustomDish[];
    onreplace:    (dish: Dish, grams: number) => void;
    onmanual:     () => void;
    onclose:      () => void;
  }

  let { sourcePlan, catalog, customDishes, onreplace, onmanual, onclose }: Props = $props();

  // Конвертировать CustomDish → Dish (отрицательные id чтобы не конфликтовали с каталогом)
  function customToDishLocal(cd: CustomDish, idx: number): Dish {
    const d = cd.data;
    return {
      id:                -(idx + 1),
      name:              d.name,
      category:          d.category,
      kcal_per_100g:     d.kcal_per_100g,
      protein_per_100g:  d.protein_per_100g,
      fat_per_100g:      d.fat_per_100g,
      carbs_per_100g:    d.carbs_per_100g,
      portion_default_g: d.portion_default_g,
      portion_min_g:     50,
      portion_max_g:     1000,
      cost_per_100g:     d.cost_per_100g,
      photo:             undefined,
      ingredients:       d.ingredients ?? [],
      _custom:           true,
    };
  }

  const customAsDishes = $derived(customDishes.map(customToDishLocal));

  const catalogMatches = $derived(
    findSimilarDishes(
      { kcal: sourcePlan.kcal, protein: sourcePlan.protein, fat: sourcePlan.fat, carbs: sourcePlan.carbs, category: sourcePlan.dish_category ?? '' },
      catalog,
    )
  );

  const customMatches = $derived(
    findSimilarDishes(
      { kcal: sourcePlan.kcal, protein: sourcePlan.protein, fat: sourcePlan.fat, carbs: sourcePlan.carbs, category: sourcePlan.dish_category ?? '' },
      customAsDishes,
    ).filter(r => r.score > 50)
  );

  let showCount = $state(5);

  const visibleCatalog = $derived(catalogMatches.slice(0, showCount));
  const hasMore = $derived(showCount < catalogMatches.length);

  function pick(item: SimilarDish) {
    const scaled = scaleDish(item.dish, sourcePlan.kcal);
    onreplace(item.dish, scaled.grams);
  }

  function scoreColor(score: number): string {
    if (score >= 85) return 'var(--color-green-primary)';
    if (score >= 65) return 'var(--color-text-muted)';
    return 'var(--color-text-muted)';
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onclose(); }} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 flex items-end justify-center sm:items-center px-0 sm:px-4"
  style="background: var(--color-overlay); backdrop-filter: blur(2px); z-index: var(--z-modal);"
  onclick={handleBackdrop}
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
    style="background: var(--color-bg-card); max-height: 90vh; border: 1px solid var(--color-border);"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Шапка -->
    <div
      class="flex items-center justify-between px-4 shrink-0"
      style="height: 52px; border-bottom: 1px solid var(--color-border);"
    >
      <button
        onclick={onclose}
        class="flex items-center gap-2 text-sm font-medium"
        style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Заменить блюдо
      </button>
      <span class="text-xs" style="color: var(--color-text-muted);">
        {sourcePlan.dish_category ?? ''}
      </span>
    </div>

    <!-- Скроллируемое содержимое -->
    <div class="overflow-y-auto flex-1 px-4 py-3" style="scrollbar-width: thin;">

      <!-- Исходное блюдо -->
      <div
        class="mb-4 rounded-lg px-3 py-2.5"
        style="background: var(--color-bg-page); border-left: 3px solid var(--color-border);"
      >
        <p class="mb-0.5 text-xs" style="color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Заменяем</p>
        <p class="text-sm font-semibold" style="color: var(--color-text-primary);">{sourcePlan.dish_name}</p>
        <p class="mt-0.5 text-xs" style="color: var(--color-text-muted);">
          {sourcePlan.kcal} ккал · Б {sourcePlan.protein}г · Ж {sourcePlan.fat}г · У {sourcePlan.carbs}г
        </p>
      </div>

      <!-- Подобранные из каталога -->
      {#if visibleCatalog.length > 0}
        <p class="mb-2 text-xs uppercase tracking-wider" style="color: var(--color-text-muted);">Подобрано по БЖУ</p>
        <div class="flex flex-col gap-1.5 mb-3">
          {#each visibleCatalog as item (item.dish.id)}
            {@const scaled = scaleDish(item.dish, sourcePlan.kcal)}
            <button
              onclick={() => pick(item)}
              class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors"
              style="background: var(--color-bg-page); border: 1px solid {item.score >= 85 ? 'var(--color-green-soft)' : 'var(--color-border)'}; cursor: pointer;"
              onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-green-soft)'; }}
              onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = item.score >= 85 ? 'var(--color-green-soft)' : 'var(--color-border)'; }}
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium" style="color: var(--color-text-primary);">{item.dish.name}</p>
                <p class="mt-0.5 text-xs" style="color: var(--color-text-muted);">
                  {scaled.kcal} ккал · {scaled.grams}г · Б{scaled.protein} · Ж{scaled.fat} · У{scaled.carbs}
                </p>
              </div>
              <div class="ml-3 shrink-0 text-right">
                <p class="text-sm font-bold" style="color: {scoreColor(item.score)};">{item.score}%</p>
                <p class="text-xs" style="color: var(--color-text-muted);">совпадение</p>
              </div>
            </button>
          {/each}
        </div>

        {#if hasMore}
          <button
            onclick={() => (showCount += 5)}
            class="mb-3 w-full rounded-lg py-2 text-xs font-medium transition-colors"
            style="border: 1px solid var(--color-green-soft); color: var(--color-green-primary); background: transparent; cursor: pointer;"
          >
            Показать ещё 5 →
          </button>
        {/if}
      {:else}
        <p class="mb-3 text-sm" style="color: var(--color-text-muted);">Похожих блюд не найдено — попробуй выбрать вручную.</p>
      {/if}

      <!-- Мои блюда -->
      {#if customMatches.length > 0}
        <p class="mb-2 text-xs uppercase tracking-wider" style="color: var(--color-text-muted);">Мои блюда</p>
        <div class="flex flex-col gap-1.5 mb-3">
          {#each customMatches as item (item.dish.id)}
            {@const scaled = scaleDish(item.dish, sourcePlan.kcal)}
            <button
              onclick={() => pick(item)}
              class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors"
              style="background: var(--color-bg-page); border: 1px solid var(--color-border); cursor: pointer;"
              onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-green-soft)'; }}
              onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)'; }}
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium" style="color: var(--color-text-primary);">{item.dish.name}</p>
                <p class="mt-0.5 text-xs" style="color: var(--color-text-muted);">
                  {scaled.kcal} ккал · {scaled.grams}г · Б{scaled.protein} · Ж{scaled.fat} · У{scaled.carbs}
                </p>
              </div>
              <div class="ml-3 shrink-0 text-right">
                <p class="text-sm font-bold" style="color: {scoreColor(item.score)};">{item.score}%</p>
                <p class="text-xs" style="color: var(--color-text-muted);">совпадение</p>
              </div>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Выбрать вручную -->
      <button
        onclick={onmanual}
        class="w-full rounded-lg py-2.5 text-xs font-medium"
        style="border: 1px dashed var(--color-border); color: var(--color-text-muted); background: transparent; cursor: pointer;"
        onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }}
        onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
      >
        Выбрать из каталога вручную
      </button>

    </div>
  </div>
</div>
```

- [ ] **Шаг 2: Проверить TypeScript**

```
pnpm check
```
Ожидаемый результат: 0 errors.

- [ ] **Шаг 3: Коммит**

```bash
git add src/lib/components/SmartReplaceModal.svelte
git commit -m "feat: SmartReplaceModal component"
```

---

## Task 3: Подключить SmartReplaceModal в `+page.svelte`

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Шаг 1: Добавить импорт**

В блоке импортов найти:
```ts
import MealModal from '$lib/components/MealModal.svelte';
```
После него добавить:
```ts
import SmartReplaceModal from '$lib/components/SmartReplaceModal.svelte';
```

- [ ] **Шаг 2: Добавить state для SmartReplaceModal**

Найти:
```ts
let replacingPlan = $state<MenuPlanRow | null>(null); // план, который заменяем
```
После добавить:
```ts
let smartReplacePlan = $state<MenuPlanRow | null>(null);
```

- [ ] **Шаг 3: Изменить `handleDetailReplace`**

Заменить:
```ts
function handleDetailReplace(plan: MenuPlanRow) {
    replacingPlan = plan;
    detailPlan = null;
    // Открываем MealModal для того же слота
    openSlot = {
        dayIdx: plan.day_index,
        meal: plan.meal_key as MealKey,
        dayLabel: `${DAY_SHORT[plan.day_index]}, ${weekDays[plan.day_index].getDate()}`
    };
}
```
На:
```ts
function handleDetailReplace(plan: MenuPlanRow) {
    detailPlan = null;
    smartReplacePlan = plan;
}
```

- [ ] **Шаг 4: Добавить обработчик выбора из SmartReplaceModal**

После `handleDetailReplace` добавить:
```ts
function handleSmartReplace(dish: Dish, grams: number) {
    if (!smartReplacePlan || !activePersona) return;
    const plan = smartReplacePlan;
    smartReplacePlan = null;
    replacingPlan = plan;
    openSlot = {
        dayIdx: plan.day_index,
        meal: plan.meal_key as MealKey,
        dayLabel: `${DAY_SHORT[plan.day_index]}, ${weekDays[plan.day_index].getDate()}`
    };
    // Сразу вызываем handleSelect с выбранным блюдом и граммами
    handleSelect(dish, grams);
}

function handleSmartReplaceManual() {
    if (!smartReplacePlan) return;
    const plan = smartReplacePlan;
    smartReplacePlan = null;
    replacingPlan = plan;
    openSlot = {
        dayIdx: plan.day_index,
        meal: plan.meal_key as MealKey,
        dayLabel: `${DAY_SHORT[plan.day_index]}, ${weekDays[plan.day_index].getDate()}`
    };
}
```

- [ ] **Шаг 5: Добавить шаблон SmartReplaceModal**

Найти в шаблоне блок:
```svelte
{#if openSlot}
<MealModal
```
Прямо перед ним добавить:
```svelte
{#if smartReplacePlan}
  <SmartReplaceModal
    sourcePlan={smartReplacePlan}
    catalog={page.data.foodCatalog ?? []}
    customDishes={page.data.customDishes ?? []}
    onreplace={(dish, grams) => handleSmartReplace(dish, grams)}
    onmanual={handleSmartReplaceManual}
    onclose={() => (smartReplacePlan = null)}
  />
{/if}
```

- [ ] **Шаг 6: Проверить TypeScript**

```
pnpm check
```
Ожидаемый результат: 0 errors.

- [ ] **Шаг 7: Проверить в браузере**

1. Открыть `/` → выбрать любое блюдо с меню → нажать «Заменить»
2. Убедиться что открывается SmartReplaceModal (не MealModal)
3. Проверить что блюда отображаются с % совпадения
4. Кликнуть на блюдо → убедиться что оно заменяется в слоте
5. Нажать «Выбрать вручную» → убедиться что открывается MealModal
6. Нажать Escape / клик вне модала → убедиться что закрывается

- [ ] **Шаг 8: Коммит**

```bash
git add src/routes/+page.svelte
git commit -m "feat: V5-095 умная замена блюда — SmartReplaceModal"
```
