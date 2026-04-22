<script lang="ts">
  import type { Dish } from '$lib/types/dish.js';
  import { browser } from '$app/environment';

  interface Props {
    name:      string;
    photo?:    string | null;
    kcal:      number;
    protein:   number;
    fat:       number;
    carbs:     number;
    grams:     number;
    cost?:     number | null;
    dish?:     Dish | null;   // для ингредиентов
    onclose:   () => void;
    onremove:  () => void;
    onreplace: () => void;
  }

  let { name, photo, kcal, protein, fat, carbs, grams, cost, dish, onclose, onremove, onreplace }: Props = $props();

  $effect(() => {
    if (!browser) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  });

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Overlay -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 flex items-end justify-center sm:items-center px-0 sm:px-4"
  style="background: var(--color-overlay); backdrop-filter: blur(2px); z-index: var(--z-modal);"
  onclick={handleBackdrop}
>
  <!-- Карточка -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="w-full max-w-md modal-enter dish-panel"
    style="
      background: var(--color-bg-card);
      box-shadow: var(--shadow-modal);
      overflow: hidden;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    "
    onclick={e => e.stopPropagation()}
  >

    <!-- Фото -->
    <div class="relative shrink-0" style="height: 220px; background: var(--color-bg-page);">
      {#if photo}
        <img
          src={photo}
          alt={name}
          style="width: 100%; height: 100%; object-fit: cover;"
        />
      {:else}
        <div class="w-full h-full flex items-center justify-center">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="28" stroke="var(--color-border)" stroke-width="2"/>
            <path d="M18 32c0-7.73 6.27-14 14-14s14 6.27 14 14" stroke="var(--color-text-muted)" stroke-width="2" stroke-linecap="round"/>
            <path d="M22 42s2 4 10 4 10-4 10-4" stroke="var(--color-text-muted)" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
      {/if}
      <!-- Кнопка закрыть -->
      <button
        type="button"
        onclick={onclose}
        class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full"
        style="background: rgba(0,0,0,0.4); color: #fff; font-size: 16px;"
        aria-label="Закрыть"
      >✕</button>
    </div>

    <!-- Контент -->
    <div class="flex-1 overflow-y-auto">

      <!-- Название + граммы -->
      <div class="px-5 pt-4 pb-3" style="border-bottom: 1px solid var(--color-border);">
        <h2 class="font-bold" style="font-size: 20px; color: var(--color-text-primary); line-height: 1.3;">
          {name}
        </h2>
        <p class="mt-1" style="font-size: 14px; color: var(--color-text-muted);">
          {grams} г
          {#if cost && cost > 0} · ~{cost} ₽{/if}
        </p>
      </div>

      <!-- КБЖУ -->
      <div class="px-5 py-4" style="border-bottom: 1px solid var(--color-border);">
        <div class="grid grid-cols-4 gap-2 text-center">
          <div style="background: var(--color-green-tint); border-radius: var(--radius-md); padding: 10px 4px;">
            <p class="font-bold" style="font-size: 18px; color: var(--color-green-primary);">{kcal}</p>
            <p style="font-size: 11px; color: var(--color-text-muted);">ккал</p>
          </div>
          <div style="background: var(--color-bg-page); border-radius: var(--radius-md); padding: 10px 4px;">
            <p class="font-bold" style="font-size: 18px; color: var(--color-macro-protein);">{protein}</p>
            <p style="font-size: 11px; color: var(--color-text-muted);">белки г</p>
          </div>
          <div style="background: var(--color-bg-page); border-radius: var(--radius-md); padding: 10px 4px;">
            <p class="font-bold" style="font-size: 18px; color: var(--color-macro-fat);">{fat}</p>
            <p style="font-size: 11px; color: var(--color-text-muted);">жиры г</p>
          </div>
          <div style="background: var(--color-bg-page); border-radius: var(--radius-md); padding: 10px 4px;">
            <p class="font-bold" style="font-size: 18px; color: var(--color-macro-carbs);">{carbs}</p>
            <p style="font-size: 11px; color: var(--color-text-muted);">углев. г</p>
          </div>
        </div>
      </div>

      <!-- Ингредиенты -->
      {#if dish?.ingredients?.length}
        <div class="px-5 py-4">
          <p class="font-semibold mb-3" style="font-size: 14px; color: var(--color-text-primary);">Ингредиенты</p>
          <ul class="flex flex-col gap-1.5">
            {#each dish.ingredients as item}
              <li class="flex items-center gap-2" style="font-size: 14px; color: var(--color-text-muted);">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--color-green-soft); flex-shrink: 0; display: inline-block;"></span>
                {typeof item === 'string' ? item : item.name}
              </li>
            {/each}
          </ul>
        </div>
      {/if}

    </div>

    <!-- Кнопки -->
    <div class="px-5 py-4 flex gap-3" style="border-top: 1px solid var(--color-border);">
      <button
        type="button"
        onclick={onreplace}
        class="btn-secondary flex-1"
        style="padding: 11px 16px; font-size: 14px;"
      >
        Заменить
      </button>
      <button
        type="button"
        onclick={onremove}
        class="flex-1 font-semibold"
        style="
          padding: 11px 16px;
          font-size: 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          background: transparent;
          color: var(--color-error);
          cursor: pointer;
          transition: background var(--transition-fast), border-color var(--transition-fast);
        "
        onmouseenter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--color-error-bg)'; el.style.borderColor = 'var(--color-error)'; }}
        onmouseleave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderColor = 'var(--color-border)'; }}
      >
        Удалить
      </button>
    </div>

  </div>
</div>

<style>
  /* Mobile: only top corners rounded (sheet slides up from bottom) */
  .dish-panel {
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  }
  /* Desktop: full border-radius (centered dialog) */
  @media (min-width: 640px) {
    .dish-panel {
      border-radius: var(--radius-xl);
    }
  }
</style>
