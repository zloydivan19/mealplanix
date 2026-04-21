<script lang="ts">
  import { page } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import { MEAL_LABELS } from '$lib/utils/week.js';
  import type { CustomDish, CustomDishData } from '$lib/types/database.js';
  import { SHOPPING_CATEGORY_LABELS, SHOPPING_CATEGORY_ORDER, type ShoppingCategory } from '$lib/types/dish.js';
  import { detectCategory } from '$lib/utils/detectIngredientCategory.js';

  let customDishes = $derived((page.data.customDishes ?? []) as CustomDish[]);

  const CATEGORY_LABELS: Record<string, string> = {
    breakfast: 'Завтрак',
    main:      'Основное',
    side:      'Гарнир',
    salad:     'Салат',
    snack:     'Перекус',
  };

  // Category badge colours
  const CAT_COLORS: Record<ShoppingCategory, { bg: string; text: string; icon: string }> = {
    meat:      { bg: 'rgba(224,123,57,0.12)',  text: 'var(--cat-meat-text)',      icon: '<circle cx="8.5" cy="3.5" r="2" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M7 5L3.5 8.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    dairy:     { bg: 'rgba(196,148,58,0.12)',  text: 'var(--cat-dairy-text)',     icon: '<path d="M6 1.5C5 3 3 5.5 3 7.5a3 3 0 006 0C9 5.5 7 3 6 1.5z" stroke="currentColor" stroke-width="1.2" fill="none"/>' },
    grain:     { bg: 'rgba(180,150,80,0.12)',  text: 'var(--cat-grain-text)',     icon: '<path d="M4 10V6M6 10V3M8 10V6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="4" cy="5" r="1.1" fill="currentColor"/><circle cx="6" cy="2" r="1.1" fill="currentColor"/><circle cx="8" cy="5" r="1.1" fill="currentColor"/>' },
    vegetable: { bg: 'rgba(30,107,69,0.10)',   text: 'var(--cat-vegetable-text)', icon: '<path d="M6 10C6 7 8.5 4 10.5 3C10.5 6 8 9 6 10z" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.1"/><path d="M6 10C6 7 3.5 4 1.5 3C1.5 6 4 9 6 10z" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="1.1"/><path d="M6 10V5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' },
    fruit:     { bg: 'rgba(190,60,110,0.10)',  text: 'var(--cat-fruit-text)',     icon: '<circle cx="6" cy="7.5" r="3.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M6 4V2.5M7.5 2c.5-.8 2-.5 1.5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>' },
    condiment: { bg: 'rgba(74,127,193,0.12)',  text: 'var(--cat-condiment-text)', icon: '<path d="M4.5 4.5V3A1.5 1.5 0 017.5 3v1.5L8.5 6v4a1 1 0 01-1 1h-3a1 1 0 01-1-1V6l1-1.5z" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="4" y1="7" x2="8" y2="7" stroke="currentColor" stroke-width="1"/>' },
    other:     { bg: 'rgba(107,117,104,0.10)', text: 'var(--cat-other-text)',     icon: '<rect x="1.5" y="1.5" width="3.5" height="3.5" rx="0.5" stroke="currentColor" stroke-width="1.1" fill="none"/><rect x="7" y="1.5" width="3.5" height="3.5" rx="0.5" stroke="currentColor" stroke-width="1.1" fill="none"/><rect x="1.5" y="7" width="3.5" height="3.5" rx="0.5" stroke="currentColor" stroke-width="1.1" fill="none"/><rect x="7" y="7" width="3.5" height="3.5" rx="0.5" stroke="currentColor" stroke-width="1.1" fill="none"/>' },
  };

  // ── FatSecret поиск ──────────────────────────────────────────────────
  interface FsResult { id: string; name: string; kcal: number; protein: number; fat: number; carbs: number; }
  let fsQuery    = $state('');
  let fsResults  = $state<FsResult[]>([]);
  let fsLoading  = $state(false);
  let fsError    = $state('');
  let fsDebounce: ReturnType<typeof setTimeout> | null = null;
  let fsOpen     = $state(false);

  function onFsInput() {
    fsError = '';
    if (fsDebounce) clearTimeout(fsDebounce);
    if (!fsQuery.trim() || fsQuery.length < 3) { fsResults = []; fsOpen = false; return; }
    fsDebounce = setTimeout(async () => {
      fsLoading = true;
      try {
        const res = await fetch(`/api/fatsecret?q=${encodeURIComponent(fsQuery)}&max=8`);
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`${res.status}: ${body}`);
        }
        fsResults = await res.json();
        fsOpen = fsResults.length > 0;
      } catch (e) {
        fsError = 'Не удалось получить данные FatSecret: ' + (e instanceof Error ? e.message : String(e));
        fsResults = [];
        fsOpen = false;
      } finally {
        fsLoading = false;
      }
    }, 400);
  }

  function applyFsResult(r: FsResult) {
    fname   = r.name;
    fkcal   = String(r.kcal);
    fprotein = String(r.protein);
    ffat    = String(r.fat);
    fcarbs  = String(r.carbs);
    fsQuery = '';
    fsResults = [];
    fsOpen  = false;
  }

  // ── Модалка ───────────────────────────────────────────────────────────
  let showModal    = $state(false);
  let editingDish  = $state<CustomDish | null>(null);
  let deleteTarget = $state<CustomDish | null>(null);
  let saving       = $state(false);
  let saveError    = $state('');

  // Поля формы
  let fname       = $state('');
  let fcategory   = $state<CustomDishData['category']>('main');
  let fstandalone = $state(false);
  let fkcal       = $state('');
  let fprotein    = $state('');
  let ffat        = $state('');
  let fcarbs      = $state('');
  let fportion    = $state('150');
  let fcost       = $state('');

  // Tag-based ingredients
  interface IngTag { name: string; category: ShoppingCategory; qty?: number; unit?: string }
  let ingTags      = $state<IngTag[]>([]);
  let ingInput     = $state('');
  let openDropdown = $state<number | null>(null); // index of tag with open dropdown

  const UNITS = ['г', 'мл', 'шт', 'щепотка'];

  function addIngFromInput() {
    const parts = ingInput.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (!ingTags.find(t => t.name.toLowerCase() === part.toLowerCase())) {
        ingTags = [...ingTags, { name: part, category: detectCategory(part), qty: undefined, unit: 'г' }];
      }
    }
    ingInput = '';
  }

  function updateIngQty(idx: number, raw: string) {
    const v = parseFloat(raw);
    ingTags = ingTags.map((t, i) => i === idx ? { ...t, qty: isNaN(v) ? undefined : v } : t);
  }

  function updateIngUnit(idx: number, unit: string) {
    ingTags = ingTags.map((t, i) => i === idx ? { ...t, unit } : t);
  }

  function handleIngKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addIngFromInput();
    } else if (e.key === 'Backspace' && ingInput === '' && ingTags.length > 0) {
      ingTags = ingTags.slice(0, -1);
    }
  }

  function removeTag(idx: number) {
    ingTags = ingTags.filter((_, i) => i !== idx);
    if (openDropdown === idx) openDropdown = null;
  }

  function changeTagCategory(idx: number, cat: ShoppingCategory) {
    ingTags = ingTags.map((t, i) => i === idx ? { ...t, category: cat } : t);
    openDropdown = null;
  }

  function toggleDropdown(idx: number) {
    openDropdown = openDropdown === idx ? null : idx;
  }

  function handleIngBlur() {
    if (ingInput.trim()) addIngFromInput();
  }

  function openCreate() {
    editingDish = null;
    fname = ''; fcategory = 'main'; fstandalone = false; fkcal = ''; fprotein = '';
    ffat = ''; fcarbs = ''; fportion = '150'; fcost = '';
    ingTags = []; ingInput = '';
    openDropdown = null;
    saveError = '';
    fsQuery = ''; fsResults = []; fsOpen = false;
    showModal = true;
  }

  function openEdit(dish: CustomDish) {
    editingDish = dish;
    const d = dish.data;
    fname     = d.name;
    fcategory   = d.category;
    fstandalone = d.standalone ?? false;
    fkcal       = String(d.kcal_per_100g);
    fprotein  = String(d.protein_per_100g);
    ffat      = String(d.fat_per_100g);
    fcarbs    = String(d.carbs_per_100g);
    fportion  = String(d.portion_default_g);
    fcost     = d.cost_per_100g ? String(d.cost_per_100g) : '';
    ingTags   = d.ingredients.map(i => ({
      name:     i.name,
      category: (i.category as ShoppingCategory) || detectCategory(i.name),
      qty:      i.qty,
      unit:     i.unit ?? 'г',
    }));
    ingInput = '';
    openDropdown = null;
    saveError = '';
    showModal = true;
  }

  function closeModal() { showModal = false; editingDish = null; openDropdown = null; }

  async function save() {
    if (saving) return;
    saveError = '';
    if (!fname.trim())                        { saveError = 'Введите название'; return; }
    if (!fkcal    || isNaN(Number(fkcal)))    { saveError = 'Укажите ккал'; return; }
    if (!fprotein || isNaN(Number(fprotein))) { saveError = 'Укажите белки'; return; }
    if (!ffat     || isNaN(Number(ffat)))     { saveError = 'Укажите жиры'; return; }
    if (!fcarbs   || isNaN(Number(fcarbs)))   { saveError = 'Укажите углеводы'; return; }

    const householdId = page.data.householdId;
    if (!householdId) return;

    // Flush any text still in input
    if (ingInput.trim()) addIngFromInput();

    // Снимаем plain-JS snapshot до первого await,
    // чтобы Svelte 5 Proxy-объекты не попали в Supabase
    const editId = editingDish?.id ?? null;
    const dishData = {
      name:              fname.trim(),
      category:          fcategory,
      standalone:        fstandalone,
      kcal_per_100g:     Number(fkcal),
      protein_per_100g:  Number(fprotein),
      fat_per_100g:      Number(ffat),
      carbs_per_100g:    Number(fcarbs),
      portion_default_g: Number(fportion) || 150,
      cost_per_100g:     Number(fcost) || 0,
      ingredients:       ingTags.map(t => ({
        name:     String(t.name),
        category: String(t.category),
        ...(t.qty != null ? { qty: Number(t.qty) } : {}),
        ...(t.unit     ? { unit: String(t.unit) } : {}),
      })),
    };

    saving = true;
    try {
      if (editId != null) {
        const { error } = await page.data.supabase
          .from('custom_dishes')
          .update({ data: dishData })
          .eq('id', editId);
        if (error) { saveError = error.message; saving = false; return; }
      } else {
        const { error } = await page.data.supabase
          .from('custom_dishes')
          .insert({ household_id: householdId, data: dishData });
        if (error) { saveError = error.message; saving = false; return; }
      }
    } catch (e: unknown) {
      saveError = e instanceof Error ? e.message : 'Ошибка сохранения';
      saving = false;
      return;
    }

    saving = false;
    closeModal();
    await invalidateAll();
  }

  async function deleteDish() {
    if (!deleteTarget) return;
    await page.data.supabase.from('custom_dishes').delete().eq('id', deleteTarget.id);
    deleteTarget = null;
    await invalidateAll();
  }

  const fieldStyle = `
    width: 100%;
    padding: 9px 12px;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 14px;
    font-family: inherit;
    color: var(--color-text-primary);
    background: var(--color-bg-page);
    outline: none;
  `;
</script>

<svelte:head><title>Блюда — MealPlaniX</title></svelte:head>

<div class="flex flex-col min-h-screen" style="background: var(--color-bg-page);">

  <!-- ── Шапка ─────────────────────────────────────────────────────────── -->
  <div class="flex items-center justify-between px-4"
    style="height: 56px; border-bottom: 1px solid var(--color-border); background: var(--color-bg-card);"
  >
    <h1 class="font-semibold" style="font-size: 15px; color: var(--color-text-primary); letter-spacing: -0.01em;">Мои блюда</h1>
    <button
      type="button"
      onclick={openCreate}
      class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
      style="background: var(--color-green-primary); color: #fff;"
      onmouseenter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-green-dark)'; }}
      onmouseleave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-green-primary)'; }}
    >+ Добавить блюдо</button>
  </div>

  <!-- ── Список ─────────────────────────────────────────────────────────── -->
  <div class="flex-1 px-4 py-4 flex flex-col gap-3">

    {#if customDishes.length === 0}
      <div class="flex flex-col items-center justify-center py-20 gap-3">
        <span style="font-size: 48px;">🍳</span>
        <p class="font-semibold" style="color: var(--color-text-primary);">Пока нет своих блюд</p>
        <p class="text-sm text-center" style="color: var(--color-text-muted);">
          Добавьте первое блюдо — оно появится<br>в планировщике рядом с остальными
        </p>
        <button
          type="button"
          onclick={openCreate}
          class="mt-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
          style="background: var(--color-green-primary); color: #fff;"
        >+ Добавить блюдо</button>
      </div>

    {:else}
      {#each customDishes as dish}
        {@const d = dish.data}
        <div style="
          background: var(--color-bg-card);
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-card);
          padding: 14px 16px;
        ">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <!-- Название + категория -->
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <p class="font-semibold text-sm" style="color: var(--color-text-primary);">{d.name}</p>
                <span class="text-xs px-2 py-0.5 rounded-full"
                  style="background: var(--color-green-soft); color: #fff; flex-shrink: 0;"
                >{CATEGORY_LABELS[d.category]}</span>
                <span class="text-xs px-2 py-0.5 rounded-full"
                  style="background: var(--color-green-tint); color: var(--color-green-primary); flex-shrink: 0;"
                >Моё</span>
              </div>

              <!-- КБЖУ -->
              <p class="text-xs mb-1" style="color: var(--color-text-muted);">
                {d.kcal_per_100g} ккал/100г · Б{d.protein_per_100g} · Ж{d.fat_per_100g} · У{d.carbs_per_100g}
                {#if d.cost_per_100g > 0}· ~{d.cost_per_100g} ₽/100г{/if}
              </p>

              <!-- Ingredient tags (read-only) -->
              {#if d.ingredients.length > 0}
                <div class="flex flex-wrap gap-1 mt-1.5">
                  {#each d.ingredients as ing}
                    {@const col = CAT_COLORS[(ing.category as ShoppingCategory) || 'other']}
                    <span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style="background: {col.bg}; color: {col.text};"
                    ><svg width="10" height="10" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;">{@html col.icon}</svg>{ing.name}</span>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Кнопки -->
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onclick={() => openEdit(dish)}
                class="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors"
                style="border: 1px solid var(--color-border); color: var(--color-text-muted);"
                onmouseenter={e => { const el = e.currentTarget as HTMLElement; el.style.background='#EEF2FF'; el.style.color='#4338CA'; }}
                onmouseleave={e => { const el = e.currentTarget as HTMLElement; el.style.background=''; el.style.color='var(--color-text-muted)'; }}
                aria-label="Редактировать"
              >✏</button>
              <button
                type="button"
                onclick={() => deleteTarget = dish}
                class="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors"
                style="border: 1px solid var(--color-border); color: var(--color-text-muted);"
                onmouseenter={e => { const el = e.currentTarget as HTMLElement; el.style.background='var(--color-error-bg)'; el.style.color='var(--color-error)'; el.style.borderColor='var(--color-error-border)'; }}
                onmouseleave={e => { const el = e.currentTarget as HTMLElement; el.style.background=''; el.style.color='var(--color-text-muted)'; el.style.borderColor='var(--color-border)'; }}
                aria-label="Удалить"
              >🗑</button>
            </div>
          </div>
        </div>
      {/each}
    {/if}

  </div>
</div>

<!-- ── Модалка создания / редактирования ──────────────────────────────── -->
{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 flex items-end md:items-center justify-center px-0 md:px-4"
    style="background: var(--color-overlay); z-index: var(--z-modal);"
    onclick={closeModal}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="w-full md:max-w-lg overflow-y-auto"
      style="
        background: var(--color-bg-card);
        border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        padding: 24px 20px 32px;
        max-height: 90vh;
      "
      onclick={e => { e.stopPropagation(); openDropdown = null; }}
    >
      <h2 class="font-bold mb-4" style="font-size: 18px; color: var(--color-text-primary);">
        {editingDish ? 'Редактировать блюдо' : 'Новое блюдо'}
      </h2>

      <!-- ── FatSecret поиск ─────────────────────────────────────── -->
      <div class="relative mb-4">
        <label for="dish-fs-search" class="block text-xs font-semibold mb-1" style="color: var(--color-text-muted);">
          Найти в FatSecret (автозаполнение КБЖУ) · <span style="font-weight: 400; color: var(--color-warning);">только на английском: chicken, rice...</span>
        </label>
        <div class="flex items-center gap-2" style="position: relative;">
          <input
            id="dish-fs-search"
            type="search"
            bind:value={fsQuery}
            oninput={onFsInput}
            placeholder="Начните вводить название продукта..."
            style="
              flex: 1;
              padding: 9px 12px;
              border: 1.5px solid var(--color-green-primary);
              border-radius: var(--radius-md);
              font-size: 14px;
              color: var(--color-text-primary);
              background: var(--color-bg-page);
              outline: none;
            "
          />
          {#if fsLoading}
            <span class="absolute right-3 top-1/2 -translate-y-1/2"
              style="width:16px;height:16px;border:2px solid var(--color-green-primary);border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;display:inline-block;">
            </span>
          {/if}
        </div>

        {#if fsError}
          <p class="text-xs mt-1" style="color: var(--color-error);">{fsError}</p>
        {/if}

        <!-- Dropdown результатов -->
        {#if fsOpen && fsResults.length > 0}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div
            class="absolute left-0 right-0 z-50 mt-1 overflow-hidden"
            style="
              background: var(--color-bg-card);
              border: 1px solid var(--color-border);
              border-radius: var(--radius-md);
              box-shadow: 0 4px 20px rgba(0,0,0,0.12);
              max-height: 240px;
              overflow-y: auto;
            "
          >
            {#each fsResults as r}
              <button
                type="button"
                onclick={() => applyFsResult(r)}
                class="w-full text-left px-3 py-2.5 transition-colors"
                style="border-bottom: 1px solid var(--color-border);"
                onmouseenter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-green-tint)'; }}
                onmouseleave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <p class="text-sm font-semibold" style="color: var(--color-text-primary);">{r.name}</p>
                <p class="text-xs mt-0.5" style="color: var(--color-text-muted);">
                  {r.kcal} ккал/100г · Б{r.protein} · Ж{r.fat} · У{r.carbs}
                </p>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex flex-col gap-3">

        <!-- Название -->
        <div>
          <label for="dish-name" class="block text-xs font-semibold mb-1" style="color: var(--color-text-muted);">Название *</label>
          <input id="dish-name" type="text" bind:value={fname} placeholder="Омлет с овощами" style={fieldStyle} />
        </div>

        <!-- Категория -->
        <div>
          <label for="dish-category" class="block text-xs font-semibold mb-1" style="color: var(--color-text-muted);">Категория *</label>
          <select id="dish-category" bind:value={fcategory} style={fieldStyle}>
            <option value="breakfast">Завтрак</option>
            <option value="main">Основное блюдо</option>
            <option value="side">Гарнир</option>
            <option value="salad">Салат</option>
            <option value="snack">Перекус</option>
          </select>
        </div>

        <!-- Без гарнира (только для основных блюд) -->
        {#if fcategory === 'main'}
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" bind:checked={fstandalone} class="w-4 h-4 rounded" style="accent-color: var(--color-green-primary);" />
            <span class="text-sm" style="color: var(--color-text-primary);">Не нужен гарнир</span>
            <span class="text-xs" style="color: var(--color-text-muted);">(пельмени, макароны по-флотски и т.п.)</span>
          </label>
        {/if}

        <!-- КБЖУ — 4 поля в ряд -->
        <div>
          <p class="block text-xs font-semibold mb-1" style="color: var(--color-text-muted);">КБЖУ на 100г *</p>
          <div class="grid grid-cols-4 gap-2">
            <div>
              <input type="number" min="0" bind:value={fkcal} placeholder="ккал" style={fieldStyle} />
              <p class="text-xs text-center mt-0.5" style="color: var(--color-text-muted);">ккал</p>
            </div>
            <div>
              <input type="number" min="0" bind:value={fprotein} placeholder="Б" style={fieldStyle + 'color: var(--color-macro-protein);'} />
              <p class="text-xs text-center mt-0.5" style="color: var(--color-macro-protein);">Белки</p>
            </div>
            <div>
              <input type="number" min="0" bind:value={ffat} placeholder="Ж" style={fieldStyle + 'color: var(--color-macro-fat);'} />
              <p class="text-xs text-center mt-0.5" style="color: var(--color-macro-fat);">Жиры</p>
            </div>
            <div>
              <input type="number" min="0" bind:value={fcarbs} placeholder="У" style={fieldStyle + 'color: var(--color-macro-carbs);'} />
              <p class="text-xs text-center mt-0.5" style="color: var(--color-macro-carbs);">Угл.</p>
            </div>
          </div>
        </div>

        <!-- Порция + цена -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="dish-portion" class="block text-xs font-semibold mb-1" style="color: var(--color-text-muted);">Порция по умолч. (г)</label>
            <input id="dish-portion" type="number" min="1" bind:value={fportion} placeholder="150" style={fieldStyle} />
          </div>
          <div>
            <label for="dish-cost" class="block text-xs font-semibold mb-1" style="color: var(--color-text-muted);">Стоимость (₽/100г)</label>
            <input id="dish-cost" type="number" min="0" bind:value={fcost} placeholder="0" style={fieldStyle} />
          </div>
        </div>

        <!-- ── Ингредиенты: tag input ────────────────────────────────── -->
        <div>
          <label for="dish-ing-input" class="block text-xs font-semibold mb-1" style="color: var(--color-text-muted);">
            Ингредиенты
          </label>

          <!-- Tag container + input -->
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div
            class="flex flex-wrap gap-1.5 p-2 cursor-text"
            style="
              border: 1.5px solid var(--color-border);
              border-radius: var(--radius-md);
              background: var(--color-bg-page);
              min-height: 44px;
            "
            onclick={e => {
              if (e.target === e.currentTarget) {
                const inp = (e.currentTarget as HTMLElement).querySelector('input');
                inp?.focus();
              }
              openDropdown = null;
            }}
          >
            {#each ingTags as tag, idx}
              {@const col = CAT_COLORS[tag.category]}
              <span class="relative inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full select-none"
                style="background: {col.bg}; color: {col.text}; max-width: 100%; vertical-align: middle;"
              >
                <!-- Category button -->
                <button
                  type="button"
                  onclick={e => { e.stopPropagation(); toggleDropdown(idx); }}
                  class="flex items-center gap-0.5 font-medium"
                  style="color: inherit; background: none; border: none; padding: 0; cursor: pointer;"
                  title="Сменить категорию"
                ><svg width="10" height="10" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;">{@html col.icon}</svg>{tag.name} ▾</button>

                <!-- Remove button -->
                <button
                  type="button"
                  onclick={e => { e.stopPropagation(); removeTag(idx); }}
                  class="ml-0.5 leading-none"
                  style="color: inherit; background: none; border: none; padding: 0; cursor: pointer; opacity: 0.6;"
                  aria-label="Удалить"
                >×</button>

                <!-- Category dropdown -->
                {#if openDropdown === idx}
                  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                  <div
                    class="absolute z-50 mt-1 rounded-xl overflow-hidden"
                    style="
                      top: 100%;
                      left: 0;
                      min-width: 160px;
                      background: var(--color-bg-card);
                      border: 1px solid var(--color-border);
                      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
                    "
                    onclick={e => e.stopPropagation()}
                  >
                    {#each SHOPPING_CATEGORY_ORDER as cat}
                      {@const c = CAT_COLORS[cat]}
                      <button
                        type="button"
                        onclick={() => changeTagCategory(idx, cat)}
                        class="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors"
                        style="
                          background: {tag.category === cat ? c.bg : 'transparent'};
                          color: {tag.category === cat ? c.text : 'var(--color-text-primary)'};
                          font-weight: {tag.category === cat ? '600' : '400'};
                        "
                        onmouseenter={e => { if (tag.category !== cat) (e.currentTarget as HTMLElement).style.background = c.bg; }}
                        onmouseleave={e => { if (tag.category !== cat) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;">{@html c.icon}</svg>{SHOPPING_CATEGORY_LABELS[cat]}
                      </button>
                    {/each}
                  </div>
                {/if}
              </span>
            {/each}

            <!-- Text input for new ingredient -->
            <input
              id="dish-ing-input"
              type="text"
              bind:value={ingInput}
              onkeydown={handleIngKeydown}
              onblur={handleIngBlur}
              placeholder={ingTags.length === 0 ? 'яйца, перец, помидоры...' : ''}
              style="
                flex: 1;
                min-width: 120px;
                border: none;
                outline: none;
                background: transparent;
                font-size: 13px;
                color: var(--color-text-primary);
                padding: 2px 4px;
              "
            />
          </div>
          <p class="text-xs mt-1" style="color: var(--color-text-muted);">
            Введите и нажмите Enter или запятую. Кликните на тег, чтобы сменить категорию.
          </p>
        </div>

        <!-- Количества ингредиентов -->
        {#if ingTags.length > 0}
          <div>
            <p class="text-sm font-semibold mb-2" style="color: var(--color-text-primary);">Количество на порцию</p>
            <div class="flex flex-col gap-1.5">
              {#each ingTags as tag, idx}
                <div class="flex items-center gap-2">
                  <span class="text-sm flex-1 truncate" style="color: var(--color-text-primary); min-width: 0;">{tag.name}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="—"
                    value={tag.qty ?? ''}
                    oninput={e => updateIngQty(idx, (e.currentTarget as HTMLInputElement).value)}
                    onclick={e => e.stopPropagation()}
                    style="
                      width: 64px; padding: 4px 6px; text-align: right;
                      border: 1px solid var(--color-border); border-radius: 6px;
                      background: var(--color-bg-page); color: var(--color-text-primary);
                      font-size: 13px; outline: none; flex-shrink: 0;
                    "
                  />
                  <select
                    value={tag.unit ?? 'г'}
                    onchange={e => updateIngUnit(idx, (e.currentTarget as HTMLSelectElement).value)}
                    onclick={e => e.stopPropagation()}
                    style="
                      padding: 4px 6px; border: 1px solid var(--color-border); border-radius: 6px;
                      background: var(--color-bg-page); color: var(--color-text-primary);
                      font-size: 13px; outline: none; flex-shrink: 0; cursor: pointer;
                    "
                  >
                    {#each UNITS as u}
                      <option value={u} selected={tag.unit === u}>{u}</option>
                    {/each}
                  </select>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Ошибка -->
        {#if saveError}
          <p class="text-sm" style="color: var(--color-error);">{saveError}</p>
        {/if}

        <!-- Кнопки -->
        <div class="flex gap-3 mt-2">
          <button
            type="button"
            onclick={closeModal}
            class="btn-secondary flex-1"
            style="padding: 11px 0;"
          >Отмена</button>
          <button
            type="button"
            onclick={save}
            disabled={saving}
            class="btn-primary flex-1"
            style="padding: 11px 0; opacity: {saving ? 0.6 : 1};"
          >{saving ? 'Сохраняю...' : 'Сохранить'}</button>
        </div>

      </div>
    </div>
  </div>
{/if}

<!-- ── Диалог удаления ────────────────────────────────────────────────── -->
{#if deleteTarget}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 flex items-center justify-center px-4"
    style="background: var(--color-overlay); z-index: var(--z-modal);"
    onclick={() => deleteTarget = null}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="w-full max-w-sm rounded-2xl p-6"
      style="background: var(--color-bg-card); box-shadow: var(--shadow-modal);"
      onclick={e => e.stopPropagation()}
    >
      <p class="font-semibold mb-2" style="font-size: 17px; color: var(--color-text-primary);">Удалить блюдо?</p>
      <p class="text-sm mb-5" style="color: var(--color-text-muted);">
        «{deleteTarget.data.name}» будет удалено навсегда.
      </p>
      <div class="flex gap-3">
        <button type="button" onclick={() => deleteTarget = null} class="btn-secondary flex-1" style="padding: 10px 0;">Отмена</button>
        <button type="button" onclick={deleteDish} class="flex-1 rounded-lg font-semibold text-sm py-2.5"
          style="background: var(--color-error); color: #fff;">Удалить</button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
