<script lang="ts">
  import { page } from '$app/state';

  let {
    collapsed      = $bindable(true),
    open           = $bindable(false),
    personaName    = '',
    onSignOut      = () => {},
    theme          = 'light',
    onToggleTheme  = () => {},
  }: {
    collapsed: boolean; open: boolean;
    personaName?: string; onSignOut?: () => void;
    theme?: 'light' | 'dark'; onToggleTheme?: () => void;
  } = $props();

  function initial(name: string): string {
    return name.trim()[0]?.toUpperCase() ?? '?';
  }

  const navItems = [
    {
      href: '/',
      label: 'Планировщик',
      icon: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <path d="M7 2v4M15 2v4M2 9h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <rect x="6" y="12" width="3" height="3" rx="0.5" fill="currentColor"/>
        <rect x="10" y="12" width="3" height="3" rx="0.5" fill="currentColor"/>
        <rect x="14" y="12" width="3" height="3" rx="0.5" fill="currentColor"/>
      </svg>`,
    },
    {
      href: '/dishes',
      label: 'Мои блюда',
      icon: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="9" r="4" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <path d="M4 19c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M16 3l1.5 1.5L20 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    },
    {
      href: '/cart',
      label: 'Корзина',
      icon: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 2h2l2.5 11h9l2-7H6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="9" cy="18" r="1.2" fill="currentColor"/>
        <circle cx="15" cy="18" r="1.2" fill="currentColor"/>
      </svg>`,
    },
    {
      href: '/fridge',
      label: 'Холодильник',
      icon: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="2" width="14" height="19" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <line x1="4" y1="9" x2="18" y2="9" stroke="currentColor" stroke-width="1.8"/>
        <line x1="11" y1="5" x2="11" y2="7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="11" y1="13" x2="11" y2="17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`,
    },
    {
      href: '/settings',
      label: 'Настройки',
      icon: `<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="3" y1="6" x2="19" y2="6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="3" y1="16" x2="19" y2="16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="8" cy="6" r="2.2" fill="var(--color-bg-card)" stroke="currentColor" stroke-width="1.8"/>
        <circle cx="14" cy="11" r="2.2" fill="var(--color-bg-card)" stroke="currentColor" stroke-width="1.8"/>
        <circle cx="8" cy="16" r="2.2" fill="var(--color-bg-card)" stroke="currentColor" stroke-width="1.8"/>
      </svg>`,
    },
  ];

  let currentPath = $derived(page.url.pathname);
</script>

<!-- Mobile backdrop -->
{#if open}
  <button class="sb-backdrop" onclick={() => open = false} aria-label="Закрыть меню"></button>
{/if}

<!-- Sidebar -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<aside
  class="sb-panel"
  class:collapsed
  class:mobile-open={open}
  onclick={() => { collapsed = !collapsed; }}
>

  <!-- Header -->
  <div class="sb-header">
    <!-- Brand: icon always visible, name only when expanded -->
    <div class="sb-brand">
      <div class="sb-logo-icon">
        <img src="/favicon.png" alt="MealPlaniX" style="height: 36px; width: 36px; object-fit: contain;" />
      </div>
      <div class="sb-appname">
        <span class="sb-appname-main">MealPlani</span><span class="sb-appname-accent">X</span>
      </div>
    </div>
    <!-- Mobile close -->
    <button
      class="sb-mobile-close"
      onclick={e => { e.stopPropagation(); open = false; }}
      aria-label="Закрыть"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <!-- Nav items -->
  <nav class="sb-nav">
    {#each navItems as item}
      {@const active = currentPath === item.href}
      <a
        href={item.href}
        onclick={e => { e.stopPropagation(); open = false; }}
        class="sb-item"
        class:active
        title={collapsed ? item.label : undefined}
      >
        <span class="sb-icon">{@html item.icon}</span>
        <span class="sb-label">{item.label}</span>
      </a>
    {/each}
  </nav>

  <!-- Separator always visible above user/toggle area -->
  <div class="sb-divider"></div>

  <!-- User section -->
  {#if personaName}
    <div class="sb-user">
      <div class="sb-user-avatar" title={collapsed ? personaName : undefined}>
        {initial(personaName)}
      </div>
      <div class="sb-user-info">
        <span class="sb-user-name">{personaName}</span>
        <button class="sb-user-signout" onclick={e => { e.stopPropagation(); onSignOut(); }}>Выйти</button>
      </div>
    </div>
  {/if}

  <!-- Theme toggle -->
  <button
    class="sb-theme"
    onclick={e => { e.stopPropagation(); onToggleTheme(); }}
    title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
  >
    {#if theme === 'dark'}
      <!-- Sun -->
      <svg class="sb-theme-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="3.5" stroke="currentColor" stroke-width="1.6"/>
        <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.42 1.42M13.36 13.36l1.42 1.42M3.22 14.78l1.42-1.42M13.36 4.64l1.42-1.42" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    {:else}
      <!-- Moon -->
      <svg class="sb-theme-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M15.5 11A7 7 0 0 1 7 2.5a7 7 0 1 0 8.5 8.5z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    {/if}
    <span class="sb-theme-label">{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
  </button>

  <!-- Desktop toggle -->
  <button
    class="sb-toggle"
    onclick={e => { e.stopPropagation(); collapsed = !collapsed; }}
    title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
    aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
  >
    <svg
      width="18" height="18" viewBox="0 0 18 18" fill="none"
      style="transition: transform 0.25s; transform: rotate({collapsed ? '0deg' : '180deg'});"
    >
      <path d="M7 4l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="sb-toggle-label">Свернуть</span>
  </button>

</aside>

<style>
  /* ── Backdrop (mobile) ──────────────────────────────────────── */
  .sb-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    z-index: 40;
    border: none;
    padding: 0;
    cursor: default;
  }

  /* ── Panel ──────────────────────────────────────────────────── */
  .sb-panel {
    position: fixed;
    top: 0;
    left: 0;
    height: 100%;
    z-index: 50;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-card);
    border-right: 1px solid var(--color-border);
    box-shadow: 2px 0 16px rgba(0,0,0,0.06);
    width: 220px;
    /* GPU layer — prevents layout reflow from affecting other elements */
    will-change: width;
    transition: width 0.28s cubic-bezier(0.4,0,0.2,1);
    overflow: hidden;
  }

  .sb-panel.collapsed {
    width: 64px;
  }

  /* ── Header ─────────────────────────────────────────────────── */
  .sb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 56px;
    padding: 0 14px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    overflow: hidden;
  }

  /* ── Brand (icon + name) ────────────────────────────────────── */
  .sb-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
    min-width: 0;
  }

  .sb-logo-icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
  }

  .sb-appname {
    white-space: nowrap;
    overflow: hidden;
    max-width: 140px;
    line-height: 1;
    /* Expand: space opens first, then text fades in */
    transition: opacity 0.14s ease 0.12s, max-width 0.28s cubic-bezier(0.4,0,0.2,1) 0s;
  }

  .sb-appname-main {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--color-text-primary);
  }

  .sb-appname-accent {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--color-green-primary);
  }

  .collapsed .sb-appname {
    opacity: 0;
    max-width: 0;
    /* Collapse: text fades first, then space closes */
    transition: opacity 0.1s ease 0s, max-width 0.28s cubic-bezier(0.4,0,0.2,1) 0.06s;
  }

  .sb-mobile-close {
    display: none;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  /* ── Nav ────────────────────────────────────────────────────── */
  .sb-nav {
    flex: 1;
    padding: 10px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    /* overflow: visible so keyboard focus rings aren't clipped — panel clips the boundary */
    overflow: visible;
  }

  .sb-item {
    display: flex;
    align-items: center;
    gap: 10px;
    /* nav inner = 64-16=48px, icon=22px → padding=(48-22)/2=13px when collapsed */
    padding: 10px;
    border-radius: 12px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    transition: background 0.15s, color 0.15s,
                gap 0.28s cubic-bezier(0.4,0,0.2,1),
                padding 0.28s cubic-bezier(0.4,0,0.2,1);
  }

  .sb-item.active {
    color: var(--color-green-primary);
    background: var(--color-green-tint);
  }

  .sb-item:hover:not(.active) {
    background: var(--color-bg-page);
  }

  .sb-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
  }

  .sb-label {
    overflow: hidden;
    white-space: nowrap;
    max-width: 160px;
    /* Expand: max-width opens (0s), opacity fades in after (0.12s delay) */
    transition: opacity 0.14s ease 0.12s, max-width 0.28s cubic-bezier(0.4,0,0.2,1) 0s;
  }

  .collapsed .sb-label {
    opacity: 0;
    max-width: 0;
    /* Collapse: opacity fades first, then space collapses */
    transition: opacity 0.1s ease 0s, max-width 0.28s cubic-bezier(0.4,0,0.2,1) 0.06s;
  }

  /* No justify-content snap — use padding to center icon instead */
  .collapsed .sb-item {
    gap: 0;
    padding: 10px 13px;
  }

  /* ── Divider (always visible, separates nav from user/toggle) ── */
  .sb-divider {
    height: 1px;
    background: var(--color-border);
    margin: 0 8px;
    flex-shrink: 0;
  }

  /* ── User section ──────────────────────────────────────────── */
  .sb-user {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 4px 8px;
    padding: 10px;
    border-radius: 12px;
    flex-shrink: 0;
    overflow: hidden;
    cursor: default;
    transition: gap 0.28s cubic-bezier(0.4,0,0.2,1),
                padding 0.28s cubic-bezier(0.4,0,0.2,1);
  }

  .sb-user-avatar {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--color-green-primary);
    color: var(--color-text-inverse);
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0;
  }

  .sb-user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    white-space: nowrap;
    max-width: 160px;
    /* Expand: max-width opens (0s), opacity fades in after (0.12s delay) */
    transition: opacity 0.14s ease 0.12s, max-width 0.28s cubic-bezier(0.4,0,0.2,1) 0s;
  }

  .sb-user-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sb-user-signout {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-muted);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    transition: color 0.15s;
  }

  .sb-user-signout:hover {
    color: var(--color-error);
  }

  /* avatar (34px) in 48px inner area → (48−34)/2 = 7px */
  .collapsed .sb-user {
    gap: 0;
    padding: 6px 7px;
  }

  .collapsed .sb-user-info {
    opacity: 0;
    max-width: 0;
    /* Collapse: opacity fades first, then space collapses */
    transition: opacity 0.1s ease 0s, max-width 0.28s cubic-bezier(0.4,0,0.2,1) 0.06s;
  }

  /* ── Theme toggle ───────────────────────────────────────────── */
  .sb-theme {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 8px 2px;
    padding: 9px 10px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    transition: background 0.15s,
                gap 0.28s cubic-bezier(0.4,0,0.2,1),
                padding 0.28s cubic-bezier(0.4,0,0.2,1);
    flex-shrink: 0;
  }

  .sb-theme:hover {
    background: var(--color-bg-page);
    color: var(--color-text-primary);
  }

  .sb-theme-icon {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
  }

  .sb-theme-label {
    overflow: hidden;
    white-space: nowrap;
    max-width: 160px;
    transition: opacity 0.14s ease 0.12s, max-width 0.28s cubic-bezier(0.4,0,0.2,1) 0s;
  }

  /* icon (18px) in 48px inner area → (48−18)/2 = 15px */
  .collapsed .sb-theme {
    gap: 0;
    padding: 9px 15px;
  }

  .collapsed .sb-theme-label {
    opacity: 0;
    max-width: 0;
    transition: opacity 0.1s ease 0s, max-width 0.28s cubic-bezier(0.4,0,0.2,1) 0.06s;
  }

  /* ── Toggle button (desktop only) ───────────────────────────── */
  .sb-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px;
    padding: 9px 10px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    transition: background 0.15s,
                gap 0.28s cubic-bezier(0.4,0,0.2,1),
                padding 0.28s cubic-bezier(0.4,0,0.2,1);
    flex-shrink: 0;
  }

  .sb-toggle:hover {
    background: var(--color-bg-page);
  }

  .sb-toggle-label {
    overflow: hidden;
    white-space: nowrap;
    max-width: 160px;
    /* Expand: max-width opens (0s), opacity fades in after */
    transition: opacity 0.14s ease 0.12s, max-width 0.28s cubic-bezier(0.4,0,0.2,1) 0s;
  }

  /* toggle icon (18px) in 48px inner area → padding=(48-18)/2=15px */
  .collapsed .sb-toggle {
    gap: 0;
    padding: 9px 15px;
  }

  .collapsed .sb-toggle-label {
    opacity: 0;
    max-width: 0;
    /* Collapse: opacity fades first, then space collapses */
    transition: opacity 0.1s ease 0s, max-width 0.28s cubic-bezier(0.4,0,0.2,1) 0.06s;
  }

  /* ── Mobile overrides (≤ 767px) ─────────────────────────────── */
  @media (max-width: 767px) {
    .sb-panel {
      width: 240px !important;
      will-change: transform;
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
    }

    .sb-panel.mobile-open {
      transform: translateX(0);
    }

    /* on mobile sidebar is always full-width */
    .sb-header              { height: 64px; }
    .collapsed .sb-label    { opacity: 1; max-width: unset; transition: none; }
    .collapsed .sb-item     { padding: 10px; gap: 10px; }
    .collapsed .sb-user     { padding: 10px; gap: 10px; }
    .collapsed .sb-user-info { max-width: 160px; opacity: 1; transition: none; }
    .collapsed .sb-toggle   { display: none; }
    .sb-toggle              { display: none; }
    .sb-mobile-close        { display: flex; }
  }
</style>
