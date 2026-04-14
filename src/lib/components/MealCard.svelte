<script lang="ts">
  interface Props {
    name:      string;
    kcal:      number;
    protein:   number;
    fat:       number;
    carbs:     number;
    cost:      number;
    grams?:    number;
    photo?:    string;
    onremove:  () => void;
    onclick?:  () => void;
  }

  let { name, kcal, protein, fat, carbs, cost, grams, photo, onremove, onclick }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="relative group w-full flex flex-col flex-1"
  style="
    background: var(--color-bg-page);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 7px 9px;
    min-height: 60px;
    box-shadow: none;
    transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
    {onclick ? 'cursor: pointer;' : ''}
  "
  onclick={onclick}
  onmouseenter={e => {
    const el = e.currentTarget as HTMLElement;
    el.style.background = 'var(--color-bg-card)';
    el.style.borderColor = 'var(--color-green-soft)';
  }}
  onmouseleave={e => {
    const el = e.currentTarget as HTMLElement;
    el.style.background = 'var(--color-bg-page)';
    el.style.borderColor = 'var(--color-border)';
  }}
>
  <!-- Кнопка удаления -->
  <button
    type="button"
    onclick={e => { e.stopPropagation(); onremove(); }}
    class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
    style="background: var(--color-error); color: #fff; font-size: 11px; line-height: 1; flex-shrink: 0;"
    aria-label="Удалить блюдо"
  >✕</button>

  <div class="flex items-start gap-2">
    <!-- Фото или placeholder -->
    {#if photo}
      <img
        src={photo}
        alt={name}
        style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px; flex-shrink: 0;"
      />
    {:else}
      <div
        class="flex items-center justify-center shrink-0"
        style="width: 44px; height: 44px; border-radius: var(--radius-sm); background: var(--color-border);"
      >
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="9" stroke="var(--color-text-muted)" stroke-width="1.5"/>
          <path d="M6 11c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="var(--color-text-muted)" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M8 14s.5 1.5 3 1.5 3-1.5 3-1.5" stroke="var(--color-text-muted)" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
    {/if}

    <!-- Текст -->
    <div class="flex-1 min-w-0 pr-5">
      <p class="font-semibold leading-tight mb-1" style="font-size: 13px; color: var(--color-text-primary);">
        {name}
      </p>
      <p style="font-size: 11px; color: var(--color-text-muted); font-variant-numeric: tabular-nums;">
        {kcal} ккал · Б{protein} · Ж{fat} · У{carbs}
      </p>
      <div class="flex items-center gap-2 mt-0.5">
        {#if grams}
          <span style="font-size: 11px; color: var(--color-text-muted);">{grams} г</span>
        {/if}
        {#if cost}
          <span class="font-semibold" style="font-size: 11px; color: var(--color-green-primary);">~{cost} ₽</span>
        {/if}
      </div>
    </div>
  </div>
</div>
