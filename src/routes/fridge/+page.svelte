<script lang="ts">
  import { page } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import type { FridgeRow } from '$lib/types/database.js';

  let fridgeItems = $derived((page.data.fridgeItems ?? []) as FridgeRow[]);
  const householdId = $derived(page.data.householdId as string | null);

  // ── Модалка добавления/редактирования ───────────────────────
  let showModal   = $state(false);
  let editingItem = $state<FridgeRow | null>(null);
  let saving      = $state(false);
  let saveError   = $state('');

  let fname      = $state('');
  let fqty       = $state('');
  let funit      = $state('г');
  let fexpires   = $state('');

  const UNITS = ['г', 'кг', 'мл', 'л', 'шт', 'упак'];

  function openAdd() {
    editingItem = null;
    fname = ''; fqty = ''; funit = 'г'; fexpires = '';
    saveError = '';
    showModal = true;
  }

  function openEdit(item: FridgeRow) {
    editingItem = item;
    fname    = item.product_name;
    fqty     = String(item.qty);
    funit    = item.unit;
    fexpires = item.expires_at ?? '';
    saveError = '';
    showModal = true;
  }

  function closeModal() { showModal = false; editingItem = null; }

  async function save() {
    if (saving) return;
    saveError = '';
    if (!fname.trim())            { saveError = 'Введите название'; return; }
    if (!fqty || isNaN(Number(fqty))) { saveError = 'Укажите количество'; return; }
    if (!householdId) return;

    const editId   = editingItem?.id ?? null;
    const rowData  = {
      product_name: fname.trim(),
      qty:          Number(fqty),
      unit:         funit,
      expires_at:   fexpires || null,
      updated_at:   new Date().toISOString(),
    };

    saving = true;
    try {
      if (editId != null) {
        const { error } = await page.data.supabase
          .from('household_fridge')
          .update(rowData)
          .eq('id', editId);
        if (error) { saveError = error.message; saving = false; return; }
      } else {
        const { error } = await page.data.supabase
          .from('household_fridge')
          .insert({ household_id: householdId, ...rowData });
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

  // ── Удаление ─────────────────────────────────────────────────
  let deleteTarget = $state<FridgeRow | null>(null);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await page.data.supabase
      .from('household_fridge')
      .delete()
      .eq('id', deleteTarget.id);
    deleteTarget = null;
    await invalidateAll();
  }

  // ── Срок годности ────────────────────────────────────────────
  function isExpired(expires_at: string | null): boolean {
    if (!expires_at) return false;
    return new Date(expires_at) < new Date(new Date().toDateString());
  }

  function isSoonExpired(expires_at: string | null): boolean {
    if (!expires_at) return false;
    const diff = new Date(expires_at).getTime() - Date.now();
    return diff >= 0 && diff < 3 * 24 * 60 * 60 * 1000; // 3 дня
  }

  function formatDate(d: string | null): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  const fieldStyle = `
    width: 100%; padding: 9px 12px;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-page);
    color: var(--color-text-primary);
    font-size: 14px; font-family: inherit; outline: none;
  `;
</script>

<svelte:head><title>Холодильник — MealPlaniX</title></svelte:head>

<div class="flex flex-col min-h-screen" style="background: var(--color-bg-page);">

  <!-- ── Шапка ─────────────────────────────────────────────────── -->
  <div class="flex items-center justify-between px-4"
    style="height: 56px; border-bottom: 1px solid var(--color-border); background: var(--color-bg-card);"
  >
    <h1 class="font-semibold" style="font-size: 15px; color: var(--color-text-primary); letter-spacing: -0.01em;">Холодильник</h1>
    <button
      type="button"
      onclick={openAdd}
      class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
      style="background: var(--color-green-primary); color: #fff;"
      onmouseenter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-green-dark)'; }}
      onmouseleave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-green-primary)'; }}
    >+ Добавить</button>
  </div>

  <!-- ── Список ─────────────────────────────────────────────────── -->
  <div class="flex-1 px-4 py-4">

    {#if fridgeItems.length === 0}
      <div class="flex flex-col items-center justify-center py-24 gap-3">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style="color: var(--color-text-muted); opacity: 0.4;">
          <rect x="10" y="6" width="44" height="52" rx="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
          <line x1="10" y1="26" x2="54" y2="26" stroke="currentColor" stroke-width="2.5"/>
          <line x1="32" y1="14" x2="32" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="32" y1="34" x2="32" y2="46" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <p class="font-semibold text-center" style="color: var(--color-text-primary);">Холодильник пуст</p>
        <p class="text-sm text-center" style="color: var(--color-text-muted);">
          Добавьте продукты — они будут вычтены из корзины автоматически
        </p>
        <button
          type="button"
          onclick={openAdd}
          class="mt-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style="background: var(--color-green-primary); color: #fff;"
        >+ Добавить продукт</button>
      </div>

    {:else}
      <div style="background: var(--color-bg-card); border-radius: var(--radius-lg); border: 1px solid var(--color-border); overflow: hidden;">
        {#each fridgeItems as item, i}
          {@const expired    = isExpired(item.expires_at)}
          {@const soonExpire = isSoonExpired(item.expires_at)}
          <div
            class="flex items-center gap-3 px-4 py-3"
            style="
              border-bottom: {i < fridgeItems.length - 1 ? '1px solid var(--color-border)' : 'none'};
              background: {expired ? 'var(--color-error-bg)' : 'var(--color-bg-card)'};
            "
          >
            <!-- Иконка -->
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink: 0; color: var(--color-text-muted);">
              <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <line x1="3" y1="8" x2="17" y2="8" stroke="currentColor" stroke-width="1.5"/>
              <line x1="10" y1="4.5" x2="10" y2="6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="10" y1="11" x2="10" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>

            <!-- Название + срок -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold truncate"
                style="color: {expired ? 'var(--color-error)' : 'var(--color-text-primary)'};"
              >{item.product_name}</p>
              {#if item.expires_at}
                <p class="text-xs mt-0.5"
                  style="color: {expired ? 'var(--color-error)' : soonExpire ? 'var(--color-warning)' : 'var(--color-text-muted)'};"
                >
                  {#if expired || soonExpire}
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style="display:inline;vertical-align:middle;margin-right:2px;flex-shrink:0;"><path d="M6 1.5L11 10H1L6 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 5v2M6 8.5v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
                  {/if}
                  {expired ? 'просрочено' : soonExpire ? 'скоро истекает' : 'до'} {formatDate(item.expires_at)}
                </p>
              {/if}
            </div>

            <!-- Кол-во -->
            <span class="text-sm font-semibold shrink-0"
              style="color: var(--color-green-primary);"
            >{item.qty % 1 === 0 ? item.qty : item.qty.toFixed(1)} {item.unit}</span>

            <!-- Кнопки -->
            <div class="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onclick={() => openEdit(item)}
                class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style="color: var(--color-text-muted); border: 1px solid var(--color-border);"
                onmouseenter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--color-green-tint)'; el.style.color = 'var(--color-green-primary)'; el.style.borderColor = 'var(--color-green-tint-border)'; }}
                onmouseleave={e => { const el = e.currentTarget as HTMLElement; el.style.background = ''; el.style.color = 'var(--color-text-muted)'; el.style.borderColor = 'var(--color-border)'; }}
                title="Редактировать"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
              </button>
              <button
                type="button"
                onclick={() => deleteTarget = item}
                class="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style="color: var(--color-text-muted); border: 1px solid var(--color-border);"
                onmouseenter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--color-error-bg)'; el.style.color = 'var(--color-error)'; el.style.borderColor = 'var(--color-error-border)'; }}
                onmouseleave={e => { const el = e.currentTarget as HTMLElement; el.style.background = ''; el.style.color = 'var(--color-text-muted)'; el.style.borderColor = 'var(--color-border)'; }}
                title="Удалить"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3.5h10M5.5 3.5V2.5h3v1M4 3.5l.7 8h4.6l.7-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- ── Модалка добавления/редактирования ─────────────────────── -->
{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 flex items-center justify-center px-4"
    style="background: var(--color-overlay); z-index: var(--z-modal);"
    onclick={closeModal}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
      style="background: var(--color-bg-card); box-shadow: var(--shadow-modal);"
      onclick={e => e.stopPropagation()}
    >
      <h2 class="font-bold text-base" style="color: var(--color-text-primary);">
        {editingItem ? 'Редактировать продукт' : 'Добавить в холодильник'}
      </h2>

      <!-- Название -->
      <div>
        <label for="fridge-name" class="block text-xs font-semibold mb-1" style="color: var(--color-text-muted);">Название *</label>
        <input id="fridge-name" type="text" bind:value={fname} placeholder="Молоко" style={fieldStyle} />
      </div>

      <!-- Количество + единица -->
      <div>
        <label for="fridge-qty" class="block text-xs font-semibold mb-1" style="color: var(--color-text-muted);">Количество *</label>
        <div class="flex gap-2">
          <input
            id="fridge-qty"
            type="number" min="0" step="0.1"
            bind:value={fqty}
            placeholder="0"
            style="{fieldStyle} flex: 1;"
          />
          <select bind:value={funit} style="{fieldStyle} width: auto; padding-left: 10px; padding-right: 10px; cursor: pointer;">
            {#each UNITS as u}
              <option value={u}>{u}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Срок годности -->
      <div>
        <label for="fridge-expires" class="block text-xs font-semibold mb-1" style="color: var(--color-text-muted);">Срок годности (необязательно)</label>
        <input id="fridge-expires" type="date" bind:value={fexpires} style={fieldStyle} />
      </div>

      {#if saveError}
        <p class="text-sm" style="color: var(--color-error);">{saveError}</p>
      {/if}

      <div class="flex gap-3 mt-1">
        <button
          type="button"
          onclick={closeModal}
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style="border: 1.5px solid var(--color-border); color: var(--color-text-muted);"
        >Отмена</button>
        <button
          type="button"
          onclick={save}
          disabled={saving}
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style="background: var(--color-green-primary); color: #fff; opacity: {saving ? 0.6 : 1};"
        >{saving ? 'Сохраняю...' : 'Сохранить'}</button>
      </div>
    </div>
  </div>
{/if}

<!-- ── Диалог удаления ───────────────────────────────────────── -->
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
      <p class="font-semibold mb-2" style="font-size: 17px; color: var(--color-text-primary);">Удалить продукт?</p>
      <p class="text-sm mb-5" style="color: var(--color-text-muted);">
        «{deleteTarget.product_name}» будет удалён из холодильника.
      </p>
      <div class="flex gap-3">
        <button
          type="button"
          onclick={() => deleteTarget = null}
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style="border: 1.5px solid var(--color-border); color: var(--color-text-muted);"
        >Отмена</button>
        <button
          type="button"
          onclick={confirmDelete}
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style="background: var(--color-error); color: #fff;"
        >Удалить</button>
      </div>
    </div>
  </div>
{/if}
