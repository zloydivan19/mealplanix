<script lang="ts">
  import { browser } from '$app/environment';

  interface Props {
    onsave:  (name: string) => void;
    onclose: () => void;
  }

  let { onsave, onclose }: Props = $props();

  let name = $state('');
  let saving = $state(false);

  const canSave = $derived(name.trim().length > 0 && name.trim().length <= 60);

  $effect(() => {
    if (!browser) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
    if (e.key === 'Enter' && canSave && !saving) submit();
  }

  function submit() {
    if (!canSave || saving) return;
    saving = true;
    onsave(name.trim());
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 flex items-center justify-center px-4"
  style="background: var(--color-overlay); backdrop-filter: blur(2px); z-index: var(--z-modal);"
  onclick={onclose}
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="w-full max-w-sm rounded-2xl p-6"
    style="background: var(--color-bg-card); border: 1px solid var(--color-border); box-shadow: var(--shadow-modal);"
    onclick={(e) => e.stopPropagation()}
  >
    <h2 class="mb-1 text-base font-bold" style="color: var(--color-text-primary);">
      Сохранить как шаблон
    </h2>
    <p class="mb-4 text-xs" style="color: var(--color-text-muted);">
      Текущая неделя будет сохранена для активной персоны
    </p>

    <label class="mb-1 block text-xs font-semibold" style="color: var(--color-text-primary);">
      Название шаблона
    </label>
    <input
      type="text"
      bind:value={name}
      maxlength={60}
      placeholder="Например: Летнее меню"
      autofocus
      class="mb-4 w-full rounded-lg px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border); background: var(--color-bg-input); color: var(--color-text-primary); outline: none;"
    />

    <div class="flex justify-end gap-2">
      <button
        type="button"
        onclick={onclose}
        class="rounded-lg px-4 py-2 text-sm font-semibold"
        style="border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted);"
      >
        Отмена
      </button>
      <button
        type="button"
        onclick={submit}
        disabled={!canSave || saving}
        class="rounded-lg px-4 py-2 text-sm font-semibold"
        style="background: var(--color-green-dark); color: var(--color-text-inverse); opacity: {!canSave || saving ? '0.5' : '1'};"
      >
        {saving ? 'Сохранение…' : 'Сохранить'}
      </button>
    </div>
  </div>
</div>
