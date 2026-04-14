<script lang="ts">
  import type { PageData } from './$types.js';

  let { data } = $props<{ data: PageData }>();

  let activeTab = $state<'login' | 'register'>('login');
  let email     = $state('');
  let password  = $state('');
  let errorMsg  = $state('');
  let loading   = $state(false);

  async function handleLogin() {
    errorMsg = '';
    loading = true;
    const { error } = await data.supabase.auth.signInWithPassword({ email, password });
    loading = false;
    if (error) errorMsg = getErrorMessage(error.message);
    else window.location.replace('/');
  }

  async function handleRegister() {
    errorMsg = '';
    loading = true;
    const { error } = await data.supabase.auth.signUp({ email, password });
    loading = false;
    if (error) errorMsg = getErrorMessage(error.message);
    else window.location.replace('/');
  }

  function getErrorMessage(msg: string): string {
    if (msg.includes('Invalid login credentials'))   return 'Неверная почта или пароль. Попробуй ещё раз?';
    if (msg.includes('User already registered'))     return 'Такая почта уже зарегистрирована. Войди?';
    if (msg.includes('Password should be at least')) return 'Пароль должен быть не менее 6 символов';
    if (msg.includes('Unable to validate email'))    return 'Неверный формат почты';
    return msg;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') activeTab === 'login' ? handleLogin() : handleRegister();
  }
</script>

<svelte:head><title>Войти — MealPlaniX</title></svelte:head>

<div class="min-h-screen flex items-center justify-center px-4" style="background: var(--color-bg-page);">
  <div class="w-full max-w-sm">

    <!-- Логотип -->
    <div class="text-center mb-8">
      <img src="/favicon.png" alt="MealPlaniX" class="mx-auto mb-3" style="width: 56px; height: 56px;" />
      <p class="font-bold mb-1" style="font-size: 24px; color: var(--color-text-primary); letter-spacing: -0.03em;">MealPlani<span style="color: var(--color-orange-accent);">X</span></p>
      <p class="text-sm" style="color: var(--color-text-muted);">Планировщик семейного меню</p>
    </div>

    <!-- Карточка -->
    <div style="background: var(--color-bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-card); border: 1px solid var(--color-border); overflow: hidden;">

      <!-- Табы -->
      <div class="flex" style="border-bottom: 1px solid var(--color-border);">
        {#each [{ id: 'login', label: 'Войти' }, { id: 'register', label: 'Регистрация' }] as tab}
          <button
            onclick={() => { activeTab = tab.id as 'login' | 'register'; errorMsg = ''; }}
            class="flex-1 py-3 text-sm font-semibold transition-colors cursor-pointer"
            style="
              color: {activeTab === tab.id ? 'var(--color-green-primary)' : 'var(--color-text-muted)'};
              background: {activeTab === tab.id ? 'var(--color-bg-card)' : 'var(--color-bg-page)'};
              border-bottom: {activeTab === tab.id ? '2px solid var(--color-green-primary)' : '2px solid transparent'};
            "
            onmouseenter={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }}
            onmouseleave={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <!-- Форма -->
      <div class="p-6 flex flex-col gap-4">
        <div>
          <label for="email" class="block text-xs font-semibold mb-1.5" style="color: var(--color-text-primary);">
            Почта
          </label>
          <input
            id="email"
            type="email"
            bind:value={email}
            onkeydown={handleKeydown}
            placeholder="katya@example.com"
            class="brand-input"
          />
        </div>

        <div>
          <label for="password" class="block text-xs font-semibold mb-1.5" style="color: var(--color-text-primary);">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            bind:value={password}
            onkeydown={handleKeydown}
            placeholder="Не менее 6 символов"
            class="brand-input"
          />
        </div>

        {#if errorMsg}
          <p class="text-sm rounded-lg px-3 py-2" style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);">
            {errorMsg}
          </p>
        {/if}

        {#if activeTab === 'login'}
          <button onclick={handleLogin} disabled={loading} class="btn-primary flex items-center justify-center gap-2">
            {#if loading}<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>{/if}
            {loading ? 'Входим...' : 'Войти'}
          </button>
        {:else}
          <button onclick={handleRegister} disabled={loading} class="btn-primary flex items-center justify-center gap-2">
            {#if loading}<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>{/if}
            {loading ? 'Создаём аккаунт...' : 'Создать аккаунт'}
          </button>
        {/if}
      </div>
    </div>

  </div>
</div>
