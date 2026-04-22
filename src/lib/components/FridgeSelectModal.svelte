<script lang="ts">
  import type { FridgeRow } from '$lib/types/database.js';

  interface Props {
    fridgeItems: FridgeRow[];
    ongenerate:  (selected: FridgeRow[]) => void;
    onclose:     () => void;
  }

  let { fridgeItems, ongenerate, onclose }: Props = $props();

  let selectedIds = $state(new Set<number>(fridgeItems.map(f => f.id)));

  const count    = $derived(selectedIds.size);
  const allOn    = $derived(count === fridgeItems.length);
  const canSubmit = $derived(count > 0);

  const pluralLabel = $derived(
    count === 1 ? 'продуктом' : 'продуктами'
  );

  function toggle(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedIds = next;
  }

  function selectAll() {
    selectedIds = new Set(fridgeItems.map(f => f.id));
  }

  function deselectAll() {
    selectedIds = new Set();
  }

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
  class="fixed inset-0 flex items-end justify-center sm:items-center px-0 sm:px-4"
  style="background: var(--color-overlay); backdrop-filter: blur(2px); z-index: var(--z-modal);"
  onclick={onclose}
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
    style="background: var(--color-bg-card); max-height: 90vh; border: 1px solid var(--color-border); box-shadow: var(--shadow-modal);"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Шапка -->
    <div
      class="flex items-start justify-between px-4 py-3 shrink-0"
      style="border-bottom: 1px solid var(--color-border);"
    >
      <div>
        <p class="text-sm font-semibold" style="color: var(--color-text-primary);">Продукты из холодильника</p>
        <p class="text-xs mt-0.5" style="color: var(--color-text-muted);">Выберите, что учитывать при генерации</p>
      </div>
      <button
        onclick={onclose}
        class="flex items-center justify-center ml-2 mt-0.5 shrink-0"
        style="background: none; border: none; color: var(--color-text-muted); cursor: pointer; width: 24px; height: 24px;"
        aria-label="Закрыть"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Строка управления -->
    <div
      class="flex items-center gap-2 px-4 py-2 shrink-0"
      style="border-bottom: 1px solid var(--color-border);"
    >
      <button
        onclick={selectAll}
        class="text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
        style="
          border: 1px solid {allOn ? 'var(--color-green-primary)' : 'var(--color-border)'};
          background: {allOn ? 'color-mix(in srgb, var(--color-green-dark) 15%, transparent)' : 'transparent'};
          color: {allOn ? 'var(--color-green-primary)' : 'var(--color-text-muted)'};
          cursor: pointer;
        "
      >
        Выбрать все
      </button>
      <button
        onclick={deselectAll}
        class="text-xs px-2.5 py-1 rounded-md font-medium"
        style="border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted); cursor: pointer;"
      >
        Снять все
      </button>
      <span class="ml-auto text-xs" style="color: var(--color-text-muted);">
        {count} из {fridgeItems.length}
      </span>
    </div>

    <!-- Список продуктов -->
    <div class="overflow-y-auto flex-1" style="max-height: 280px; scrollbar-width: thin;">
      {#each fridgeItems as item (item.id)}
        {@const checked = selectedIds.has(item.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
          onclick={() => toggle(item.id)}
          class="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
          style="
            background: {checked ? 'color-mix(in srgb, var(--color-green-dark) 12%, transparent)' : 'transparent'};
            border-bottom: 1px solid var(--color-border);
          "
        >
          <!-- Чекбокс -->
          <div
            style="
              width: 16px; height: 16px; border-radius: 4px; shrink: 0; flex-shrink: 0;
              background: {checked ? 'var(--color-green-primary)' : 'transparent'};
              border: 1.5px solid {checked ? 'var(--color-green-primary)' : 'var(--color-border)'};
              display: flex; align-items: center; justify-content: center;
            "
          >
            {#if checked}
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="var(--color-text-inverse)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {/if}
          </div>

          <!-- Название -->
          <span
            class="flex-1 text-sm truncate"
            style="color: {checked ? 'var(--color-text-primary)' : 'var(--color-text-muted)'};"
          >
            {item.product_name}
          </span>

          <!-- Количество -->
          <span class="text-xs shrink-0" style="color: var(--color-text-muted);">
            {item.qty} {item.unit}
          </span>
        </div>
      {/each}
    </div>

    <!-- Футер -->
    <div class="px-4 py-3 shrink-0" style="border-top: 1px solid var(--color-border);">
      <button
        onclick={submit}
        disabled={!canSubmit}
        class="w-full rounded-xl py-3 text-sm font-semibold transition-colors"
        style="
          background: {canSubmit ? 'var(--color-green-primary)' : 'var(--color-bg-surface)'};
          color: {canSubmit ? 'var(--color-text-inverse)' : 'var(--color-text-muted)'};
          border: none; cursor: {canSubmit ? 'pointer' : 'default'};
        "
      >
        {#if canSubmit}
          ⚡ Сгенерировать с {count} {pluralLabel}
        {:else}
          Выберите хотя бы один продукт
        {/if}
      </button>
    </div>
  </div>
</div>
