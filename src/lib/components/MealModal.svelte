<script lang="ts">
  import { page } from '$app/state';
  import { MEAL_LABELS, type MealKey } from '$lib/utils/week.js';
  import type { Dish, DishCategory } from '$lib/types/dish.js';
  import type { CustomDish } from '$lib/types/database.js';

  const SLOT_CATEGORIES: Record<MealKey, DishCategory[]> = {
    bf: ['breakfast'],
    ln: ['main', 'side', 'salad'],
    dn: ['main', 'salad'],
    sn: ['snack'],
  };

  interface Props {
    mealKey:     MealKey;
    dayLabel:    string;
    onselect:    (dish: Dish, grams: number) => void;
    onclose:     () => void;
    foodCatalog?: Dish[];
  }

  let { mealKey, dayLabel, onselect, onclose, foodCatalog = [] }: Props = $props();

  // Кастомные блюда из профиля
  let customDishes = $derived(
    ((page.data.customDishes ?? []) as CustomDish[])
      .filter(cd => SLOT_CATEGORIES[mealKey].includes(cd.data.category as DishCategory))
      .map((cd): Dish => ({
        id:                cd.id,
        name:              cd.data.name,
        category:          cd.data.category as DishCategory,
        kcal_per_100g:     cd.data.kcal_per_100g,
        protein_per_100g:  cd.data.protein_per_100g,
        fat_per_100g:      cd.data.fat_per_100g,
        carbs_per_100g:    cd.data.carbs_per_100g,
        portion_min_g:     50,
        portion_max_g:     1000,
        portion_default_g: cd.data.portion_default_g,
        cost_per_100g:     cd.data.cost_per_100g,
        photo:             undefined,
        ingredients:       cd.data.ingredients,
        _custom:           true,
      }))
  );

  // Каталог: фильтр по категории слота
  let catalogDishes = $derived(
    foodCatalog.filter(d => SLOT_CATEGORIES[mealKey].includes(d.category))
  );

  // ── Шаг 1: список ────────────────────────────────────────────────────
  let query = $state('');

  let filteredCustom = $derived(
    customDishes.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
  );

  let filteredCatalog = $derived(
    catalogDishes.filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
  );

  let filtered = $derived([...filteredCustom, ...filteredCatalog]);

  // ── Шаг 2: ввод граммовки ─────────────────────────────────────────────
  type Step = 'list' | 'portion';
  let step         = $state<Step>('list');
  let selectedDish = $state<Dish | null>(null);
  let grams        = $state(0);

  let preview = $derived.by(() => {
    if (!selectedDish) return null;
    const k = grams / 100;
    return {
      kcal:    Math.round(selectedDish.kcal_per_100g    * k),
      protein: Math.round(selectedDish.protein_per_100g * k),
      fat:     Math.round(selectedDish.fat_per_100g     * k),
      carbs:   Math.round(selectedDish.carbs_per_100g   * k),
      cost:    Math.round(selectedDish.cost_per_100g    * k),
    };
  });

  function selectDish(dish: Dish) {
    selectedDish = dish;
    grams        = dish.portion_default_g;
    step         = 'portion';
  }

  function handleGramsInput(e: Event) {
    const v = (e.target as HTMLInputElement).valueAsNumber;
    if (isNaN(v) || v <= 0) { grams = 1; return; }
    grams = Math.min(v, 9999);
  }

  function confirm() {
    if (!selectedDish) return;
    onselect(selectedDish, grams);
  }

  function goBack() {
    step         = 'list';
    selectedDish = null;
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (step === 'portion') goBack();
      else onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Overlay -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 flex items-start justify-center px-4"
  style="padding-top: 10vh; background: var(--color-overlay); backdrop-filter: blur(2px); z-index: var(--z-modal);"
  onclick={handleBackdrop}
  role="dialog"
  aria-modal="true"
  aria-label="Выбор блюда"
>
  <!-- Окно -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="w-full max-w-md modal-enter"
    style="
      background: var(--color-bg-card);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-modal);
      overflow: hidden;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    "
    onclick={e => e.stopPropagation()}
  >

    <!-- ── Заголовок ──────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between px-5 py-4" style="border-bottom: 1px solid var(--color-border);">
      <div class="flex items-center gap-2">
        {#if step === 'portion'}
          <button
            type="button"
            onclick={goBack}
            class="flex items-center justify-center w-7 h-7 rounded-full transition-colors"
            style="color: var(--color-text-muted); background: var(--color-bg-page);"
            aria-label="Назад к списку"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        {/if}
        <div>
          <h3 class="font-semibold" style="font-size: 18px; color: var(--color-text-primary);">
            {MEAL_LABELS[mealKey]}
          </h3>
          <p class="text-xs mt-0.5" style="color: var(--color-text-muted);">{dayLabel}</p>
        </div>
      </div>
      <button
        type="button"
        onclick={onclose}
        class="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
        style="color: var(--color-text-muted); background: var(--color-bg-page);"
        aria-label="Закрыть"
      >✕</button>
    </div>

    <!-- ── ШАГ 1: список блюд ─────────────────────────────────────────── -->
    {#if step === 'list'}

      <!-- Поиск -->
      <div class="px-5 py-3" style="border-bottom: 1px solid var(--color-border);">
        <input
          type="search"
          bind:value={query}
          placeholder="Поиск блюда..."
          class="brand-input"
          style="padding: 8px 14px; font-size: 14px;"
          autofocus
        />
      </div>

      <!-- Список -->
      <div class="overflow-y-auto flex-1 py-2">
        {#if filtered.length === 0}
          <div class="text-center py-10" style="color: var(--color-text-muted); font-size: 14px;">
            Ничего не нашлось
          </div>
        {:else}
          {#each filtered as dish}
            <button
              type="button"
              onclick={() => selectDish(dish)}
              class="w-full text-left px-5 py-3 transition-colors flex items-center gap-3"
              style="border-bottom: 1px solid var(--color-border);"
              onmouseenter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-green-tint)'; }}
              onmouseleave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {#if dish.photo}
                <img src={dish.photo} alt={dish.name} style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; flex-shrink: 0;" />
              {:else}
                <div style="width: 40px; height: 40px; border-radius: 6px; background: var(--color-border); flex-shrink: 0;"></div>
              {/if}
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="font-semibold" style="font-size: 14px; color: var(--color-text-primary);">
                    {dish.name}
                  </p>
                  {#if dish._custom}
                    <span class="text-xs px-1.5 py-0.5 rounded shrink-0"
                      style="background: var(--color-green-tint); color: var(--color-green-primary);">Моё</span>
                  {/if}
                </div>
                <p style="font-size: 12px; color: var(--color-text-muted);">
                  {dish.kcal_per_100g} ккал/100г · Б{dish.protein_per_100g} · Ж{dish.fat_per_100g} · У{dish.carbs_per_100g}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink: 0; color: var(--color-text-muted);">
                <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          {/each}
        {/if}
      </div>

    <!-- ── ШАГ 2: ввод граммовки ──────────────────────────────────────── -->
    {:else if step === 'portion' && selectedDish}

      <div class="flex-1 overflow-y-auto">

        <!-- Превью блюда -->
        <div class="px-5 pt-5 pb-4 flex items-center gap-4" style="border-bottom: 1px solid var(--color-border);">
          {#if selectedDish.photo}
            <img
              src={selectedDish.photo}
              alt={selectedDish.name}
              style="width: 64px; height: 64px; object-fit: cover; border-radius: var(--radius-md); flex-shrink: 0;"
            />
          {:else}
            <div style="width: 64px; height: 64px; border-radius: var(--radius-md); background: var(--color-border); flex-shrink: 0;"></div>
          {/if}
          <div class="flex-1 min-w-0">
            <p class="font-semibold" style="font-size: 16px; color: var(--color-text-primary); line-height: 1.3;">
              {selectedDish.name}
            </p>
            {#if preview}
              <p class="mt-1" style="font-size: 13px; color: var(--color-green-primary); font-weight: 600;">
                {preview.kcal} ккал
              </p>
              <p style="font-size: 12px; color: var(--color-text-muted);">
                Б{preview.protein} · Ж{preview.fat} · У{preview.carbs}
                {#if preview.cost > 0} · ~{preview.cost} ₽{/if}
              </p>
            {/if}
          </div>
        </div>

        <!-- Ввод граммовки -->
        <div class="px-5 py-5">
          <label for="grams-input" class="block text-sm font-semibold mb-3" style="color: var(--color-text-primary);">
            Граммовка порции
          </label>

          <div class="flex items-center gap-3 mb-2">
            <input
              id="grams-input"
              type="number"
              value={grams}
              oninput={handleGramsInput}
              min={selectedDish.portion_min_g}
              max={selectedDish.portion_max_g}
              class="brand-input"
              style="width: 120px; padding: 10px 14px; font-size: 18px; font-weight: 600; text-align: center;"
            />
            <span style="font-size: 16px; color: var(--color-text-muted); font-weight: 500;">г</span>
          </div>

          <p class="text-xs" style="color: var(--color-text-muted);">
            Рекомендуемый диапазон: {selectedDish.portion_min_g}–{selectedDish.portion_max_g} г
            · {selectedDish.kcal_per_100g} ккал/100г
          </p>
        </div>

      </div>

      <!-- Кнопка Добавить -->
      <div class="px-5 py-4" style="border-top: 1px solid var(--color-border);">
        <button
          type="button"
          onclick={confirm}
          class="btn-primary"
          style="padding: 12px 20px;"
        >
          Добавить {grams} г
        </button>
      </div>

    {/if}

  </div>
</div>
