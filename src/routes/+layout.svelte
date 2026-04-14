<script lang="ts">
  import { untrack } from 'svelte';
  import { browser } from '$app/environment';
  import './layout.css';
  import type { LayoutData } from './$types.js';
  import Sidebar from '$lib/components/Sidebar.svelte';
  let { data, children } = $props<{ data: LayoutData; children: any }>();

  // Server already read the cookie — no flash on navigation.
  // untrack: intentionally capturing only the initial server value.
  let sidebarCollapsed = $state(untrack(() => data.sidebarCollapsed ?? true));
  let sidebarOpen      = $state(false);

  // ── Тема ────────────────────────────────────────────────────────────────
  function getInitialTheme(): 'light' | 'dark' {
    if (!browser) return 'light';
    const stored = localStorage.getItem('pm_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  let theme = $state<'light' | 'dark'>(untrack(getInitialTheme));

  function toggleTheme() { theme = theme === 'dark' ? 'light' : 'dark'; }

  $effect(() => {
    if (!browser) return;
    localStorage.setItem('pm_theme', theme);
    document.documentElement.dataset.theme = theme;
  });

  $effect(() => {
    if (!browser) return;
    // Persist as cookie (readable server-side → no SSR flash)
    document.cookie = `pm_sidebar=${sidebarCollapsed ? 'collapsed' : 'expanded'}; path=/; max-age=31536000`;
  });

  const MINI_W = 64;
  const FULL_W = 220;
  let sbW = $derived(sidebarCollapsed ? MINI_W : FULL_W);

  async function handleSignOut() {
    await data.supabase.auth.signOut();
    window.location.replace('/auth');
  }
</script>

{#if data.session}
  <Sidebar
    bind:collapsed={sidebarCollapsed}
    bind:open={sidebarOpen}
    personaName={data.persona?.name ?? ''}
    onSignOut={handleSignOut}
    {theme}
    onToggleTheme={toggleTheme}
  />

  <!-- Content shifts right on desktop to make room for the fixed sidebar -->
  <div class="layout-wrap" style="--sb-w: {sbW}px">
    {@render children()}
  </div>

{:else}
  {@render children()}
{/if}

<style>
  .layout-wrap {
    transition: margin-left 0.28s cubic-bezier(0.4,0,0.2,1);
  }

  @media (min-width: 768px) {
    .layout-wrap {
      margin-left: var(--sb-w);
    }
  }

  @media (max-width: 767px) {
    .layout-wrap {
      margin-left: 0 !important;
    }
  }
</style>
