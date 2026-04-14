<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getWeekDays, getWeekLabel, getWeekId } from '$lib/utils/week.js';
  import { aggregateIngredients, type CartItem } from '$lib/utils/ingredients.js';
  import { SHOPPING_CATEGORY_LABELS } from '$lib/types/dish.js';
  import type { Dish, CustomDish, FridgeRow } from '$lib/types/database.js';
  import type { PageData } from './$types.js';
  import type { CartStateRow } from './+page.server.js';

  let { data } = $props<{ data: PageData }>();

  // ── Навигация по неделям ──────────────────────────────────────────────
  let weekOffset = $state(browser ? Number(localStorage.getItem('pm_cart_week') ?? 0) : 0);
  let weekDays   = $derived(getWeekDays(weekOffset));
  let weekLabel  = $derived(getWeekLabel(weekDays));
  let weekId     = $derived(getWeekId(weekDays));

  $effect(() => {
    if (browser) localStorage.setItem('pm_cart_week', String(weekOffset));
  });

  // ── Агрегация ингредиентов из меню ───────────────────────────────────
  let fridge = $derived((page.data.fridgeItems ?? []) as FridgeRow[]);

  // Карта холодильника: название_lowercase → { qty, unit }
  let fridgeMap = $derived(
    new Map(fridge.map(f => [f.product_name.trim().toLowerCase(), f]))
  );

  let groups = $derived.by(() => {
    const plans  = (data.menuPlans ?? []) as { week_label: string; dish_name: string }[];
    const names  = plans.filter(p => p.week_label === weekId).map(p => p.dish_name);
    const customs = (page.data.customDishes ?? []) as CustomDish[];
    const catalog = (page.data.foodCatalog  ?? []) as Dish[];
    return aggregateIngredients(names, customs, catalog);
  });

  let allItems   = $derived(groups.flatMap(g => g.items));
  let totalItems = $derived(allItems.length);

  // ── Локальный стейт (инициализируется из БД) ──────────────────────────
  // checked: Set имён
  let checked = $state<Set<string>>(
    new Set((data.cartState as CartStateRow[]).filter(r => r.is_checked).map(r => r.ingredient_name))
  );
  // prices: name → число
  let prices = $state<Record<string, number>>(
    Object.fromEntries(
      (data.cartState as CartStateRow[]).filter(r => r.price > 0).map(r => [r.ingredient_name, r.price])
    )
  );

  let checkedCount = $derived(allItems.filter(i => checked.has(i.name)).length);

  // ── household_id (нужен для upsert) ──────────────────────────────────
  const householdId: string | null = page.data.householdId ?? null;

  // ── Upsert в Supabase ─────────────────────────────────────────────────
  async function upsertRow(name: string, patch: { price?: number; is_checked?: boolean }) {
    if (!householdId) return;
    const current = (data.cartState as CartStateRow[]).find(r => r.ingredient_name === name);
    await page.data.supabase
      .from('cart_state')
      .upsert({
        household_id:    householdId,
        week_label:      weekId,
        ingredient_name: name,
        price:           patch.price      ?? current?.price      ?? 0,
        is_checked:      patch.is_checked ?? current?.is_checked ?? false,
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'household_id,week_label,ingredient_name' });
  }

  // ── Чекбокс ───────────────────────────────────────────────────────────
  function toggle(name: string) {
    const next = new Set(checked);
    const nowChecked = !next.has(name);
    nowChecked ? next.add(name) : next.delete(name);
    checked = next;
    upsertRow(name, { is_checked: nowChecked });
  }

  async function resetChecked() {
    checked = new Set();
    if (!householdId) return;
    await page.data.supabase
      .from('cart_state')
      .update({ is_checked: false, updated_at: new Date().toISOString() })
      .eq('household_id', householdId)
      .eq('week_label', weekId);
  }

  // ── Цена ─────────────────────────────────────────────────────────────
  let priceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

  function handlePriceInput(name: string, raw: string) {
    const v = parseFloat(raw);
    const val = isNaN(v) ? 0 : v;
    prices = { ...prices, [name]: val };
    // Debounce — пишем в БД через 600мс после последнего ввода
    clearTimeout(priceTimers[name]);
    priceTimers[name] = setTimeout(() => upsertRow(name, { price: val }), 600);
  }

  // ── Итого ─────────────────────────────────────────────────────────────
  let totalCost = $derived(
    allItems.reduce((s, i) => s + (prices[i.name] ?? 0), 0)
  );
  let remainingCost = $derived(
    allItems.filter(i => !checked.has(i.name)).reduce((s, i) => s + (prices[i.name] ?? 0), 0)
  );

  // ── Экспорт ───────────────────────────────────────────────────────────
  let exportToast = $state(false);

  function exportCart() {
    let text = `🛒 Список покупок — ${weekLabel}\n\n`;
    for (const group of groups) {
      const unchecked = group.items.filter(i => !checked.has(i.name));
      if (unchecked.length === 0) continue;
      text += `${SHOPPING_CATEGORY_LABELS[group.category]}\n`;
      for (const item of unchecked) {
        const price = prices[item.name] ? ` — ${prices[item.name]} ₽` : '';
        text += `  • ${item.name}${price}\n`;
      }
      text += '\n';
    }
    if (totalCost > 0) text += `Всего: ~${totalCost} ₽\n`;
    if (remainingCost > 0 && remainingCost !== totalCost) text += `Осталось докупить: ~${remainingCost} ₽\n`;
    navigator.clipboard.writeText(text).then(() => {
      exportToast = true;
      setTimeout(() => exportToast = false, 2500);
    });
  }

  const CATEGORY_ICONS: Record<string, string> = {
    meat: '🥩', dairy: '🥛', grain: '🌾',
    vegetable: '🥦', fruit: '🍎', condiment: '🧂', other: '🛒',
  };

  function sortedItems(items: CartItem[]) {
    return [...items].sort((a, b) => {
      const ac = checked.has(a.name) ? 1 : 0;
      const bc = checked.has(b.name) ? 1 : 0;
      return ac - bc;
    });
  }
</script>

<svelte:head><title>Список покупок — MealPlaniX</title></svelte:head>

<div class="flex flex-col min-h-screen" style="background: var(--color-bg-page);">

  <!-- ── Шапка ─────────────────────────────────────────────────────────── -->
  <div class="px-4 pt-4 pb-3" style="border-bottom: 1px solid var(--color-border); background: var(--color-bg-card);">

    <!-- Навигация по неделям -->
    <div class="flex items-center justify-between gap-3 mb-3">
      <button
        onclick={() => weekOffset--}
        class="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-lg"
        style="background: var(--color-bg-page); border: 1.5px solid var(--color-border); color: var(--color-text-primary);"
        aria-label="Предыдущая неделя"
      >←</button>

      <div class="text-center flex-1">
        <p class="font-semibold text-sm" style="color: var(--color-text-primary);">{weekLabel}</p>
        <p class="text-xs" style="color: var(--color-text-muted);">
          {#if weekOffset === 0}Текущая неделя
          {:else if weekOffset === 1}Следующая неделя
          {:else if weekOffset === -1}Прошлая неделя
          {:else}{weekOffset > 0 ? '+' : ''}{weekOffset} нед.
          {/if}
        </p>
      </div>

      <button
        onclick={() => weekOffset++}
        class="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-lg"
        style="background: var(--color-bg-page); border: 1.5px solid var(--color-border); color: var(--color-text-primary);"
        aria-label="Следующая неделя"
      >→</button>
    </div>

    <!-- Счётчик + кнопки -->
    <div class="flex items-center gap-2 flex-wrap">
      {#if totalItems > 0}
        <p class="text-sm mr-auto" style="color: var(--color-text-muted);">
          Куплено: <span class="font-semibold" style="color: var(--color-text-primary);">{checkedCount} / {totalItems}</span>
        </p>
        {#if checkedCount > 0}
          <button
            type="button"
            onclick={resetChecked}
            class="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style="color: var(--color-text-muted); border: 1px solid var(--color-border);"
            onmouseenter={e => { const el = e.currentTarget as HTMLElement; el.style.background='var(--color-error-bg)'; el.style.color='var(--color-error)'; el.style.borderColor='var(--color-error-border)'; }}
            onmouseleave={e => { const el = e.currentTarget as HTMLElement; el.style.background=''; el.style.color='var(--color-text-muted)'; el.style.borderColor='var(--color-border)'; }}
          >Сбросить отметки</button>
        {/if}
        <button
          type="button"
          onclick={exportCart}
          class="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5"
          style="background: var(--color-green-primary); color: #fff;"
          onmouseenter={e => { (e.currentTarget as HTMLElement).style.background='var(--color-green-dark)'; }}
          onmouseleave={e => { (e.currentTarget as HTMLElement).style.background='var(--color-green-primary)'; }}
        >📋 Экспорт</button>
      {/if}
    </div>
  </div>

  <!-- ── Список ─────────────────────────────────────────────────────────── -->
  <div class="flex-1 px-4 py-4 flex flex-col gap-5">

    {#if groups.length === 0}
      <div class="flex flex-col items-center justify-center flex-1 py-20 gap-3">
        <span style="font-size: 48px;">🛒</span>
        <p class="font-semibold text-center" style="color: var(--color-text-primary);">Корзина пуста</p>
        <p class="text-sm text-center" style="color: var(--color-text-muted);">
          Сгенерируйте меню на эту неделю —<br>
          ингредиенты появятся здесь автоматически
        </p>
      </div>

    {:else}

      {#each groups as group}
        <div>
          <!-- Заголовок категории -->
          <div class="flex items-center gap-2 mb-2 px-1">
            <span style="font-size: 16px;">{CATEGORY_ICONS[group.category]}</span>
            <span class="font-semibold text-sm" style="color: var(--color-text-primary);">
              {SHOPPING_CATEGORY_LABELS[group.category]}
            </span>
            <span class="text-xs ml-auto" style="color: var(--color-text-muted);">
              {group.items.filter(i => checked.has(i.name)).length}/{group.items.length}
            </span>
          </div>

          <!-- Позиции -->
          <div style="background: var(--color-bg-card); border-radius: var(--radius-lg); border: 1px solid var(--color-border); overflow: hidden;">
            {#each sortedItems(group.items) as item, i (item.name)}
              {@const isChecked   = checked.has(item.name)}
              {@const fridgeEntry = fridgeMap.get(item.name.trim().toLowerCase())}
              {@const needQty     = (item.totalQty != null && fridgeEntry && fridgeEntry.unit === item.unit)
                ? Math.max(0, item.totalQty - fridgeEntry.qty)
                : item.totalQty}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <div
                class="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                style="
                  border-bottom: {i < group.items.length - 1 ? '1px solid var(--color-border)' : 'none'};
                  background: {isChecked ? 'var(--color-bg-page)' : 'var(--color-bg-card)'};
                "
                onclick={() => toggle(item.name)}
                onmouseenter={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.background = 'var(--color-green-tint)'; }}
                onmouseleave={e => { (e.currentTarget as HTMLElement).style.background = isChecked ? 'var(--color-bg-page)' : 'var(--color-bg-card)'; }}
              >
                <!-- Чекбокс -->
                <div class="w-5 h-5 rounded shrink-0 flex items-center justify-center mt-0.5"
                  style="
                    border: 2px solid {isChecked ? 'var(--color-green-primary)' : 'var(--color-border)'};
                    background: {isChecked ? 'var(--color-green-primary)' : 'transparent'};
                  "
                >
                  {#if isChecked}
                    <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                      <path d="M1 4L4 7L10 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  {/if}
                </div>

                <!-- Основной контент -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline gap-2 flex-wrap">
                    <p class="text-sm transition-all"
                      style="
                        color: {isChecked ? 'var(--color-text-muted)' : 'var(--color-text-primary)'};
                        text-decoration: {isChecked ? 'line-through' : 'none'};
                        font-weight: 500;
                      "
                    >{item.name}</p>
                    {#if item.totalQty != null && item.unit}
                      <span class="text-xs shrink-0"
                        style="color: var(--color-text-muted); text-decoration: {isChecked ? 'line-through' : 'none'};"
                      >{item.totalQty % 1 === 0 ? item.totalQty : item.totalQty.toFixed(1)} {item.unit}</span>
                    {/if}
                    {#if fridgeEntry && item.unit && fridgeEntry.unit === item.unit}
                      <span class="text-xs shrink-0" style="color: #0284C7;">🧊 −{fridgeEntry.qty} {fridgeEntry.unit}</span>
                    {/if}
                    {#if needQty != null && item.unit && !isChecked}
                      <span class="text-xs font-bold shrink-0"
                        style="color: {needQty === 0 ? 'var(--color-success)' : 'var(--color-green-primary)'};"
                      >
                        {needQty === 0 ? '✓ есть' : `= ${needQty % 1 === 0 ? needQty : needQty.toFixed(1)} ${item.unit}`}
                      </span>
                    {/if}
                  </div>

                  {#if item.sources.length > 0 && !isChecked}
                    <div class="flex flex-wrap gap-1 mt-1">
                      {#each item.sources as src}
                        <span class="text-xs px-1.5 py-0.5 rounded"
                          style="background: var(--color-green-tint); color: var(--color-green-primary); white-space: nowrap;"
                        >{src}</span>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- Поле цены -->
                {#if !isChecked}
                  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                  <div class="flex items-center gap-1 shrink-0" onclick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={prices[item.name] ?? ''}
                      oninput={e => handlePriceInput(item.name, (e.currentTarget as HTMLInputElement).value)}
                      class="text-sm text-right rounded"
                      style="
                        width: 64px;
                        padding: 4px 6px;
                        border: 1px solid var(--color-border);
                        background: var(--color-bg-page);
                        color: var(--color-text-primary);
                        outline: none;
                      "
                    />
                    <span class="text-xs" style="color: var(--color-text-muted);">₽</span>
                  </div>
                {:else}
                  {#if prices[item.name]}
                    <span class="text-xs shrink-0" style="color: var(--color-text-muted); text-decoration: line-through;">
                      {prices[item.name]} ₽
                    </span>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}

    {/if}
  </div>

  <!-- Отступ снизу чтобы контент не перекрывался fixed-панелью -->
  <div style="height: 20px;"></div>
</div>

<!-- ── Fixed итого ────────────────────────────────────────────────────── -->
<div class="fixed bottom-5 right-5 flex items-center gap-3"
  style="z-index: var(--z-sticky);"
>
  <div class="flex flex-col items-end px-4 py-2 rounded-xl"
    style="background: var(--color-bg-card); color: var(--color-text-primary); border: 1px solid var(--color-border); backdrop-filter: blur(6px); box-shadow: var(--shadow-modal);"
  >
    <span class="text-xs opacity-60">Всего</span>
    <span class="font-bold" style="font-size: 15px;">{totalCost} ₽</span>
  </div>
  <div class="flex flex-col items-end px-4 py-2 rounded-xl"
    style="background: var(--color-green-primary); color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,0.2);"
  >
    <span class="text-xs opacity-80">Осталось</span>
    <span class="font-bold" style="font-size: 15px;">{remainingCost} ₽</span>
  </div>
</div>

<!-- Toast -->
{#if exportToast}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg"
    style="background: var(--color-text-primary); color: var(--color-text-inverse); z-index: var(--z-toast); white-space: nowrap;"
  >
    ✓ Скопировано в буфер обмена
  </div>
{/if}
