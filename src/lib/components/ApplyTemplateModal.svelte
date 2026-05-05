<script lang="ts">
  import { browser } from '$app/environment';
  import type { MenuTemplate } from '$lib/types/database.js';

  type MergeMode = 'replace' | 'fill';

  interface Props {
    templates:  MenuTemplate[];
    userId:     string;
    onapply:    (template: MenuTemplate, mode: MergeMode) => void;
    ondelete:   (templateId: number) => void;
    onclose:    () => void;
  }

  let { templates, userId, onapply, ondelete, onclose }: Props = $props();

  let selectedId = $state<number | null>(templates[0]?.id ?? null);
  let mergeMode  = $state<MergeMode>('replace');
  let applying   = $state(false);

  const selectedTemplate = $derived(templates.find((t) => t.id === selectedId) ?? null);
  const canApply = $derived(selectedTemplate !== null && !applying);

  $effect(() => {
    if (!browser) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  function submit() {
    if (!canApply || !selectedTemplate) return;
    applying = true;
    onapply(selectedTemplate, mergeMode);
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
    class="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5"
    style="background: var(--color-bg-card); border: 1px solid var(--color-border); box-shadow: var(--shadow-modal);"
    onclick={(e) => e.stopPropagation()}
  >
    <h2 class="mb-4 text-base font-bold" style="color: var(--color-text-primary);">
      Применить шаблон
    </h2>

    {#if templates.length === 0}
      <p class="py-6 text-center text-sm" style="color: var(--color-text-muted);">
        Нет сохранённых шаблонов
      </p>
    {:else}
      <p class="mb-2 text-xs font-semibold" style="color: var(--color-text-primary);">Шаблон:</p>
      <div class="mb-4 flex max-h-48 flex-col gap-1.5 overflow-y-auto">
        {#each templates as t}
          <div
            class="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5"
            style="
              border: 1px solid {selectedId === t.id ? 'var(--color-green-tint-border)' : 'var(--color-border)'};
              background: {selectedId === t.id ? 'var(--color-green-tint)' : 'var(--color-bg-page)'};
            "
            role="button"
            tabindex="0"
            onclick={() => (selectedId = t.id)}
            onkeydown={(e) => { if (e.key === 'Enter') selectedId = t.id; }}
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold" style="color: var(--color-text-primary);">{t.name}</p>
              <p class="text-xs" style="color: var(--color-text-muted);">
                {t.slots.length} блюд · {formatDate(t.created_at)}
              </p>
            </div>
            {#if t.created_by === userId}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <button
                type="button"
                onclick={(e) => { e.stopPropagation(); ondelete(t.id); }}
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
                style="color: var(--color-text-muted);"
                aria-label="Удалить шаблон"
                onmouseenter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-error)'}
                onmouseleave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 3.5h10M5.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M6 6v4M8 6v4M3 3.5l.7 7a.5.5 0 0 0 .5.5h5.6a.5.5 0 0 0 .5-.5l.7-7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            {/if}
          </div>
        {/each}
      </div>

      <p class="mb-2 text-xs font-semibold" style="color: var(--color-text-primary);">Режим применения:</p>
      <div class="mb-5 flex flex-col gap-1.5">
        <label class="flex cursor-pointer items-center gap-2 text-sm" style="color: var(--color-text-primary);">
          <input type="radio" bind:group={mergeMode} value="replace" class="accent-green-700" />
          <span><strong>Заменить</strong> — перезаписать текущее меню</span>
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-sm" style="color: var(--color-text-primary);">
          <input type="radio" bind:group={mergeMode} value="fill" class="accent-green-700" />
          <span><strong>Дополнить</strong> — только пустые слоты</span>
        </label>
      </div>
    {/if}

    <div class="flex justify-end gap-2">
      <button
        type="button"
        onclick={onclose}
        class="rounded-lg px-4 py-2 text-sm font-semibold"
        style="border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted);"
      >
        Отмена
      </button>
      {#if templates.length > 0}
        <button
          type="button"
          onclick={submit}
          disabled={!canApply}
          class="rounded-lg px-4 py-2 text-sm font-semibold"
          style="background: var(--color-green-dark); color: var(--color-text-inverse); opacity: {!canApply ? '0.5' : '1'};"
        >
          {applying ? 'Применяю…' : 'Применить'}
        </button>
      {/if}
    </div>
  </div>
</div>
