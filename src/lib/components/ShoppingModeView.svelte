<script lang="ts">
  import { browser } from '$app/environment';
  import type { CartItem } from '$lib/utils/ingredients.js';
  import { SHOPPING_CATEGORY_LABELS, type ShoppingCategory } from '$lib/types/dish.js';

  interface ManualItem {
    name:     string;
    qty:      number | null;
    unit:     string;
    category: ShoppingCategory;
  }

  interface CartGroup {
    category:    ShoppingCategory;
    items:       CartItem[];
    manualItems: ManualItem[];
  }

  interface Props {
    groups:        CartGroup[];
    checked:       Set<string>;
    prices:        Record<string, number>;
    onToggle:      (name: string) => void;
    onClose:       () => void;
    onComplete:    () => void;
    completing?:   boolean;
  }

  let { groups, checked, prices, onToggle, onClose, onComplete, completing = false }: Props = $props();

  // ── Прогресс ──────────────────────────────────────────────────────────
  let allNames = $derived(
    groups.flatMap((g) => [...g.items.map((i) => i.name), ...g.manualItems.map((m) => m.name)])
  );
  let total      = $derived(allNames.length);
  let checkedCnt = $derived(allNames.filter((n) => checked.has(n)).length);
  let spent      = $derived(
    allNames.filter((n) => checked.has(n)).reduce((s, n) => s + (prices[n] ?? 0), 0)
  );
  let totalCost  = $derived(allNames.reduce((s, n) => s + (prices[n] ?? 0), 0));
  let progressPct = $derived(total > 0 ? Math.round((checkedCnt / total) * 100) : 0);

  // ── Wake Lock API ─────────────────────────────────────────────────────
  let wakeLock: WakeLockSentinel | null = null;

  async function requestWakeLock() {
    if (!browser || !('wakeLock' in navigator)) return;
    try {
      wakeLock = await (navigator as Navigator & { wakeLock: WakeLock }).wakeLock.request('screen');
    } catch {
      // Wake Lock не поддерживается или отклонён — игнорируем
    }
  }

  function releaseWakeLock() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  $effect(() => {
    if (!browser) return;
    requestWakeLock();
    document.body.style.overflow = 'hidden';
    // Reacquire wake lock on visibility change (when user returns to tab)
    const onVisChange = () => {
      if (document.visibilityState === 'visible' && wakeLock === null) requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      releaseWakeLock();
      document.body.style.overflow = '';
      document.removeEventListener('visibilitychange', onVisChange);
    };
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  // ── Подтверждение завершения ─────────────────────────────────────────
  let confirmingComplete = $state(false);
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="shop-mode" style="z-index: var(--z-modal);">

  <!-- ═══ Sticky header: progress + close ═══ -->
  <header class="shop-hd">
    <div class="hd-top">
      <button
        type="button"
        class="hd-close"
        onclick={onClose}
        aria-label="Выйти из режима покупок"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <div class="hd-title">
        <p class="hd-counts">{checkedCnt} из {total}</p>
        <p class="hd-money">{Math.round(spent)} ₽ из {Math.round(totalCost)} ₽</p>
      </div>
    </div>
    <div class="hd-progress">
      <div class="prog-fill" style="width: {progressPct}%"></div>
    </div>
  </header>

  <!-- ═══ Список товаров ═══ -->
  <div class="shop-bd">
    {#each groups as group}
      {@const groupItems = [...group.items, ...group.manualItems]}
      {@const groupDone = groupItems.filter((i) => checked.has(i.name)).length}
      <section class="cat">
        <h2 class="cat-title">
          {SHOPPING_CATEGORY_LABELS[group.category]}
          <span class="cat-count">{groupDone}/{groupItems.length}</span>
        </h2>

        <ul class="items">
          {#each groupItems as item (item.name)}
            {@const isChecked = checked.has(item.name)}
            {@const price = prices[item.name] ?? 0}
            <li>
              <button
                type="button"
                class="item"
                class:item--checked={isChecked}
                onclick={() => onToggle(item.name)}
              >
                <div class="item-check" class:item-check--on={isChecked}>
                  {#if isChecked}
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10l4 4 8-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  {/if}
                </div>
                <div class="item-main">
                  <p class="item-name">{item.name}</p>
                  <p class="item-meta">
                    {#if 'totalQty' in item && item.totalQty != null && item.unit}
                      {item.totalQty} {item.unit}
                    {:else if 'qty' in item && item.qty != null && item.unit}
                      {item.qty} {item.unit}
                    {/if}
                  </p>
                </div>
                {#if price > 0}
                  <p class="item-price">{price} ₽</p>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>

  <!-- ═══ Sticky footer: Завершить ═══ -->
  <footer class="shop-ft">
    {#if !confirmingComplete}
      <button
        type="button"
        class="btn-complete"
        onclick={() => (confirmingComplete = true)}
        disabled={checkedCnt === 0}
      >
        Завершить покупки {checkedCnt > 0 ? `(${checkedCnt})` : ''}
      </button>
    {:else}
      <div class="confirm-row">
        <button type="button" class="btn-cancel" onclick={() => (confirmingComplete = false)}>
          Отмена
        </button>
        <button
          type="button"
          class="btn-complete btn-complete--confirm"
          onclick={onComplete}
          disabled={completing}
        >
          {completing ? 'Сохраняю…' : `Перенести ${checkedCnt} в холодильник`}
        </button>
      </div>
    {/if}
  </footer>

</div>

<style>
  .shop-mode {
    position: fixed;
    inset: 0;
    background: var(--color-bg-page);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ═══ HEADER ═══ */
  .shop-hd {
    flex-shrink: 0;
    background: var(--color-bg-card);
    border-bottom: 1px solid var(--color-border);
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  .hd-top {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px 12px;
  }
  .hd-close {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-bg-page);
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background var(--transition-fast);
  }
  .hd-close:active {
    background: var(--color-border);
  }
  .hd-title {
    flex: 1;
    min-width: 0;
  }
  .hd-counts {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1.2;
  }
  .hd-money {
    font-size: 13px;
    color: var(--color-text-muted);
    margin-top: 2px;
  }
  .hd-progress {
    height: 4px;
    background: var(--color-bg-page);
    overflow: hidden;
  }
  .prog-fill {
    height: 100%;
    background: var(--color-green-primary);
    transition: width var(--transition-base);
  }

  /* ═══ BODY ═══ */
  .shop-bd {
    flex: 1;
    overflow-y: auto;
    padding: 16px 16px 100px;
    -webkit-overflow-scrolling: touch;
  }
  .cat {
    margin-bottom: 24px;
  }
  .cat-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cat-count {
    color: var(--color-text-muted);
    font-weight: 400;
    font-size: 12px;
  }
  .items {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* ═══ ITEM ═══ */
  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px 16px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    text-align: left;
    transition: background var(--transition-fast), opacity var(--transition-fast);
    min-height: 64px;
  }
  .item:active {
    background: var(--color-bg-page);
  }
  .item--checked {
    opacity: 0.55;
  }
  .item--checked .item-name {
    text-decoration: line-through;
  }
  .item-check {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid var(--color-border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    transition: background var(--transition-fast), border-color var(--transition-fast);
  }
  .item-check--on {
    background: var(--color-green-primary);
    border-color: var(--color-green-primary);
  }
  .item-main {
    flex: 1;
    min-width: 0;
  }
  .item-name {
    font-size: 16px;
    font-weight: 500;
    color: var(--color-text-primary);
    line-height: 1.25;
  }
  .item-meta {
    font-size: 13px;
    color: var(--color-text-muted);
    margin-top: 2px;
  }
  .item-price {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
    flex-shrink: 0;
  }

  /* ═══ FOOTER ═══ */
  .shop-ft {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 12px 16px max(12px, env(safe-area-inset-bottom));
    background: var(--color-bg-card);
    border-top: 1px solid var(--color-border);
    box-shadow: 0 -1px 4px rgba(0,0,0,0.06);
  }
  .btn-complete {
    width: 100%;
    padding: 16px;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    background: var(--color-green-primary);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast), opacity var(--transition-fast);
  }
  .btn-complete:disabled {
    background: var(--color-border);
    color: var(--color-text-muted);
    cursor: not-allowed;
  }
  .btn-complete--confirm {
    flex: 1;
  }
  .confirm-row {
    display: flex;
    gap: 8px;
  }
  .btn-cancel {
    padding: 16px 20px;
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text-primary);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
</style>
