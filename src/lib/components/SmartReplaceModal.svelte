<script lang="ts">
  import type { Dish } from '$lib/types/dish.js';
  import type { CustomDish } from '$lib/types/database.js';
  import { findSimilarDishes, scaleDish, customToDish } from '$lib/utils/generate.js';
  import type { SimilarDish } from '$lib/utils/generate.js';
  import type { MenuPlanRow } from '../../routes/+page.server.js';
  import { browser } from '$app/environment';

  interface Props {
    sourcePlan:   MenuPlanRow;
    catalog:      Dish[];
    customDishes: CustomDish[];
    onreplace:    (dish: Dish, grams: number) => void;
    onmanual:     () => void;
    onclose:      () => void;
  }

  let { sourcePlan, catalog, customDishes, onreplace, onmanual, onclose }: Props = $props();

  $effect(() => {
    if (!browser) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  });

  const customAsDishes = $derived(customDishes.map(customToDish));

  const sourceKey = $derived({ kcal: sourcePlan.kcal, protein: sourcePlan.protein, fat: sourcePlan.fat, carbs: sourcePlan.carbs, category: sourcePlan.dish_category ?? '' });

  const catalogMatches = $derived(
    findSimilarDishes(sourceKey, catalog)
      .filter(r => r.dish.name !== sourcePlan.dish_name)
  );

  const customMatches = $derived(
    findSimilarDishes(sourceKey, customAsDishes)
      .filter(r => r.score > 50 && r.dish.name !== sourcePlan.dish_name)
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
