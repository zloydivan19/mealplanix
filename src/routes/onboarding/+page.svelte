<script lang="ts">
  import { page } from '$app/state';
  import { calcKbju, ACTIVITY_LABELS } from '$lib/utils/kbju.js';
  import type { ActivityLevel, Formula, Gender } from '$lib/types/database.js';

  let step    = $state(1);
  let loading = $state(false);
  let errorMsg = $state('');

  let name         = $state('');
  let gender       = $state<Gender>('male');
  let age          = $state<number | ''>('');
  let weight       = $state<number | ''>('');
  let height       = $state<number | ''>('');
  let activity     = $state<ActivityLevel>('moderate');
  let formula      = $state<Formula>('mifflin');
  let kcalOverride = $state<number | ''>('');

  // Режим: false = просто планирую, true = считаю КБЖУ
  let trackKcal = $state(false);

  let bf = $state(25);
  let ln = $state(40);
  let dn = $state(35);

  let kbju = $derived.by(() => {
    if (!trackKcal) return null;
    if (!age || !weight || !height) return null;
    return calcKbju(
      gender, Number(age), Number(weight), Number(height),
      activity, formula,
      kcalOverride !== '' ? Number(kcalOverride) : null
    );
  });

  let ratioSum   = $derived(bf + ln + dn);
  let ratioValid = $derived(ratioSum === 100);

  function handleKcalOverride(e: Event) {
    const v = (e.target as HTMLInputElement).valueAsNumber;
    kcalOverride = isNaN(v) ? '' : v;
  }

  function clearOverride() { kcalOverride = ''; }

  async function savePersona() {
    if (!name.trim()) { errorMsg = 'Нужно ввести имя'; return; }
    if (trackKcal && !kbju) { errorMsg = 'Заполни возраст, вес и рост'; return; }
    if (trackKcal && !ratioValid) { errorMsg = 'Сумма % по приёмам пищи должна быть 100'; return; }

    loading = true;
    errorMsg = '';

    const supabase    = page.data.supabase;
    const user        = page.data.user;
    const householdId = page.data.householdId;

    const { error } = await supabase.from('personas').insert({
      household_id:   householdId!,
      user_id:        user!.id,
      name:           name.trim(),
      gender,
      age:            trackKcal && age    !== '' ? Number(age)    : null,
      weight:         trackKcal && weight !== '' ? Number(weight) : null,
      height:         trackKcal && height !== '' ? Number(height) : null,
      activity:       trackKcal ? activity : null,
      formula,
      kcal_target:    kbju?.kcal    ?? null,
      protein_target: kbju?.protein ?? null,
      fat_target:     kbju?.fat     ?? null,
      carbs_target:   kbju?.carbs   ?? null,
      meal_ratios:    trackKcal ? { bf, ln, dn } : { bf: 25, ln: 40, dn: 35 },
      carry_dinner_to_lunch: true,
      match_kcal:     trackKcal,
    });

    loading = false;
    if (error) { errorMsg = 'Не получилось сохранить. ' + error.message; return; }
    step = 3;
  }

  function finish() { window.location.replace('/'); }
</script>

<svelte:head><title>Добро пожаловать — MealPlaniX</title></svelte:head>

<div class="min-h-screen flex items-center justify-center px-4 py-8" style="background: var(--color-bg-page);">
  <div class="w-full max-w-md">

    <!-- Индикатор шагов -->
    <div class="flex items-center justify-center gap-2 mb-8">
      {#each [1, 2, 3] as s}
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
          style="
            background: {step === s ? 'var(--color-green-primary)' : step > s ? 'var(--color-green-tint)' : 'var(--color-border)'};
            color:      {step === s ? '#fff' : step > s ? 'var(--color-green-primary)' : 'var(--color-text-muted)'};
          "
        >{#if step > s}<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3.5 3.5 5.5-5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>{:else}{s}{/if}</div>
        {#if s < 3}
          <div class="w-8 h-0.5" style="background: {step > s ? 'var(--color-green-soft)' : 'var(--color-border)'};"></div>
        {/if}
      {/each}
    </div>

    <!-- ШАГ 1 -->
    {#if step === 1}
      <div class="p-8 text-center" style="background: var(--color-bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-card); border: 1px solid var(--color-border);">
        <img src="/logo1.jpg" alt="MealPlaniX" class="mx-auto mb-4" style="height: 80px; object-fit: contain; mix-blend-mode: multiply;" />
        <p class="font-bold mb-2" style="font-size: 26px; color: var(--color-text-primary); letter-spacing: -0.03em;">MealPlani<span style="color: var(--color-orange-accent);">X</span></p>
        <h1 class="font-bold mb-3" style="font-size: clamp(18px,3vw,22px); color: var(--color-green-primary);">
          Добро пожаловать!
        </h1>
        <p class="mb-2" style="color: var(--color-text-primary); font-size: 15px; line-height: 1.6;">
          Планируй меню на неделю, следи за КБЖУ и формируй список покупок для всей семьи — в одном месте.
        </p>
        <p class="mb-8 text-sm" style="color: var(--color-text-muted);">
          Сначала расскажи немного о себе — рассчитаем норму калорий и питательных веществ.
        </p>
        <button onclick={() => step = 2} class="btn-primary inline-flex items-center justify-center gap-2">
          Начать
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

    <!-- ШАГ 2 -->
    {:else if step === 2}
      <div class="p-6" style="background: var(--color-bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-card); border: 1px solid var(--color-border);">
        <h2 class="font-semibold mb-5" style="font-size: 20px; color: var(--color-text-primary);">Твой профиль</h2>

        <div class="flex flex-col gap-4">

          <!-- Имя -->
          <div>
            <label for="name" class="block text-xs font-semibold mb-1.5" style="color: var(--color-text-primary);">
              Как тебя зовут?
            </label>
            <input id="name" type="text" bind:value={name} placeholder="Например: Катя" class="brand-input" />
          </div>

          <!-- Пол -->
          <div>
            <p class="text-xs font-semibold mb-2" style="color: var(--color-text-primary);">Пол</p>
            <div class="flex gap-2">
              {#each [{ val: 'male', label: 'Мужской' }, { val: 'female', label: 'Женский' }] as g}
                <button
                  onclick={() => gender = g.val as Gender}
                  class="flex-1 py-2.5 text-sm font-semibold transition-all"
                  style="
                    border-radius: var(--radius-md);
                    border: 1.5px solid {gender === g.val ? 'var(--color-green-primary)' : 'var(--color-border)'};
                    background: {gender === g.val ? 'var(--color-green-primary)' : 'var(--color-bg-card)'};
                    color: {gender === g.val ? '#fff' : 'var(--color-text-muted)'};
                  "
                >{g.label}</button>
              {/each}
            </div>
          </div>

          <!-- Переключатель режима КБЖУ -->
          <div style="border-radius: var(--radius-lg); border: 1px solid {trackKcal ? 'var(--color-green-tint-border)' : 'var(--color-border)'}; overflow: hidden; transition: border-color var(--transition-fast);">

            <!-- Заголовок-переключатель -->
            <button
              type="button"
              onclick={() => { trackKcal = !trackKcal; }}
              class="w-full flex items-center justify-between px-4 py-3"
              style="background: {trackKcal ? 'var(--color-green-tint)' : 'var(--color-bg-page)'}; border: none; cursor: pointer; transition: background var(--transition-fast);"
            >
              <div class="flex items-center gap-3">
                <div
                  class="relative w-10 h-6 rounded-full shrink-0"
                  style="background: {trackKcal ? 'var(--color-green-primary)' : 'var(--color-border)'}; transition: background var(--transition-fast);"
                >
                  <span
                    class="absolute top-1 w-4 h-4 rounded-full shadow block"
                    style="background: var(--color-text-inverse); transform: translateX({trackKcal ? '20px' : '4px'}); transition: transform var(--transition-fast);"
                  ></span>
                </div>
                <span class="text-sm font-semibold text-left" style="color: {trackKcal ? 'var(--color-green-primary)' : 'var(--color-text-primary)'};">
                  Считаю калории и слежу за КБЖУ
                </span>
              </div>
            </button>

            <!-- Пояснение под переключателем -->
            <div class="px-4 pb-3 pt-1">
              {#if trackKcal}
                <p class="text-xs" style="color: var(--color-text-muted); line-height: 1.5;">
                  Заполни параметры — рассчитаем твою норму и будем подбирать блюда по ккал.
                </p>
              {:else}
                <p class="text-xs" style="color: var(--color-text-muted); line-height: 1.5;">
                  Без подсчётов — просто удобное меню на неделю. Блюда будут подбираться случайно из доступных вариантов.
                  Включить учёт КБЖУ можно в настройках в любой момент.
                </p>
              {/if}
            </div>

          </div>

          <!-- Блок КБЖУ — показываем только если trackKcal -->
          {#if trackKcal}

            <!-- Возраст / Вес / Рост -->
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label for="age" class="block text-xs font-semibold mb-1.5" style="color: var(--color-text-primary);">Возраст</label>
                <input id="age" type="number" bind:value={age} min="10" max="100" placeholder="30" class="brand-input" style="padding: 10px;" />
              </div>
              <div>
                <label for="weight" class="block text-xs font-semibold mb-1.5" style="color: var(--color-text-primary);">Вес (кг)</label>
                <input id="weight" type="number" bind:value={weight} min="30" max="300" placeholder="70" class="brand-input" style="padding: 10px;" />
              </div>
              <div>
                <label for="height" class="block text-xs font-semibold mb-1.5" style="color: var(--color-text-primary);">Рост (см)</label>
                <input id="height" type="number" bind:value={height} min="100" max="250" placeholder="175" class="brand-input" style="padding: 10px;" />
              </div>
            </div>

            <!-- Активность -->
            <div>
              <label for="activity" class="block text-xs font-semibold mb-1.5" style="color: var(--color-text-primary);">
                Уровень активности
              </label>
              <select id="activity" bind:value={activity} class="brand-input">
                {#each Object.entries(ACTIVITY_LABELS) as [val, label]}
                  <option value={val}>{label}</option>
                {/each}
              </select>
            </div>

            <!-- Результат КБЖУ -->
            {#if kbju}
              <div style="background: var(--color-green-tint); border-radius: var(--radius-lg); padding: 16px; border: 1px solid var(--color-green-tint-border);">
                <p class="text-xs font-semibold uppercase mb-3" style="color: var(--color-green-primary);">
                  Твоя суточная норма
                </p>
                <div class="grid grid-cols-4 gap-2 text-center mb-3">
                  <div>
                    <p class="text-lg font-bold" style="color: var(--color-green-primary);">{kbju.kcal}</p>
                    <p class="text-xs" style="color: var(--color-text-muted);">ккал</p>
                  </div>
                  <div>
                    <p class="text-lg font-bold" style="color: var(--color-macro-protein);">{kbju.protein}</p>
                    <p class="text-xs" style="color: var(--color-text-muted);">белки г</p>
                  </div>
                  <div>
                    <p class="text-lg font-bold" style="color: var(--color-macro-fat);">{kbju.fat}</p>
                    <p class="text-xs" style="color: var(--color-text-muted);">жиры г</p>
                  </div>
                  <div>
                    <p class="text-lg font-bold" style="color: var(--color-macro-carbs);">{kbju.carbs}</p>
                    <p class="text-xs" style="color: var(--color-text-muted);">углев. г</p>
                  </div>
                </div>
                <!-- Ручная коррекция -->
                <div style="border-top: 1px solid var(--color-green-tint-border); padding-top: 12px;">
                  <p class="text-xs mb-2" style="color: var(--color-text-muted);">Скорректировать калории вручную:</p>
                  <div class="flex gap-2">
                    <input
                      type="number"
                      value={kcalOverride !== '' ? kcalOverride : ''}
                      oninput={handleKcalOverride}
                      placeholder={String(kbju.kcal)}
                      min="800" max="6000"
                      class="brand-input"
                      style="padding: 8px 12px; font-size: 14px;"
                    />
                    {#if kcalOverride !== ''}
                      <button onclick={clearOverride} class="btn-ghost">Сброс</button>
                    {/if}
                  </div>
                </div>
              </div>
            {:else}
              <div class="text-center py-4" style="background: var(--color-bg-page); border-radius: var(--radius-lg); border: 1px solid var(--color-border);">
                <p class="text-sm" style="color: var(--color-text-muted);">
                  Заполни возраст, вес и рост — рассчитаем норму автоматически
                </p>
              </div>
            {/if}

            <!-- Распределение -->
            <div>
              <p class="text-xs font-semibold mb-3" style="color: var(--color-text-primary);">
                Распределение калорий по приёмам пищи
              </p>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label for="bf" class="block text-xs mb-1.5 text-center" style="color: var(--color-text-muted);">Завтрак</label>
                  <div class="relative">
                    <input id="bf" type="number" bind:value={bf} min="0" max="100"
                      class="brand-input {!ratioValid ? 'error' : ''}"
                      style="padding: 10px 24px 10px 10px; text-align: center;" />
                    <span class="absolute right-2 top-1/2 -translate-y-1/2 text-sm" style="color: var(--color-text-muted);">%</span>
                  </div>
                </div>
                <div>
                  <label for="ln" class="block text-xs mb-1.5 text-center" style="color: var(--color-text-muted);">Обед</label>
                  <div class="relative">
                    <input id="ln" type="number" bind:value={ln} min="0" max="100"
                      class="brand-input {!ratioValid ? 'error' : ''}"
                      style="padding: 10px 24px 10px 10px; text-align: center;" />
                    <span class="absolute right-2 top-1/2 -translate-y-1/2 text-sm" style="color: var(--color-text-muted);">%</span>
                  </div>
                </div>
                <div>
                  <label for="dn" class="block text-xs mb-1.5 text-center" style="color: var(--color-text-muted);">Ужин</label>
                  <div class="relative">
                    <input id="dn" type="number" bind:value={dn} min="0" max="100"
                      class="brand-input {!ratioValid ? 'error' : ''}"
                      style="padding: 10px 24px 10px 10px; text-align: center;" />
                    <span class="absolute right-2 top-1/2 -translate-y-1/2 text-sm" style="color: var(--color-text-muted);">%</span>
                  </div>
                </div>
              </div>
              <p class="text-xs mt-2 text-center flex items-center justify-center gap-1" style="color: {ratioValid ? 'var(--color-success)' : 'var(--color-error)'};">
                {#if ratioValid}<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>{/if}
                Сумма: {ratioSum}%{ratioValid ? '' : ' — должно быть 100%'}
              </p>
            </div>

          {/if}
          <!-- /блок КБЖУ -->

          {#if errorMsg}
            <p class="text-sm rounded-lg px-3 py-2" style="color: var(--color-error); background: var(--color-error-bg); border: 1px solid var(--color-error-border);">
              {errorMsg}
            </p>
          {/if}

          <div class="flex gap-3 mt-2">
            <button onclick={() => step = 1} class="btn-secondary inline-flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 7H3M6 4l-3 3 3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Назад
            </button>
            <button onclick={savePersona} disabled={loading} class="btn-primary inline-flex items-center justify-center gap-2">
              {#if loading}<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>{/if}
              {loading ? 'Сохраняем...' : 'Готово'}
              {#if !loading}<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>{/if}
            </button>
          </div>

        </div>
      </div>

    <!-- ШАГ 3 -->
    {:else if step === 3}
      <div class="p-8 text-center" style="background: var(--color-bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-card); border: 1px solid var(--color-border);">
        <div class="flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-4" style="background: var(--color-green-tint); border: 2px solid var(--color-green-tint-border);">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style="color: var(--color-green-primary);">
            <path d="M6 16l7 7 13-13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h2 class="font-semibold mb-3" style="font-size: 24px; color: var(--color-text-primary);">Профиль создан!</h2>
        <p class="mb-6" style="color: var(--color-text-muted); font-size: 15px;">
          Теперь можно планировать меню на неделю.
        </p>

        {#if page.data.household}
          <div class="text-left mb-6 p-4" style="background: var(--color-bg-page); border-radius: var(--radius-lg);">
            <p class="text-xs font-semibold uppercase mb-2" style="color: var(--color-text-muted);">
              Код приглашения семьи
            </p>
            <p class="font-bold tracking-widest" style="font-size: 24px; color: var(--color-green-primary);">
              {page.data.household.invite_code}
            </p>
            <p class="text-xs mt-1" style="color: var(--color-text-muted);">
              Поделись кодом с членами семьи, чтобы они могли присоединиться
            </p>
          </div>
        {/if}

        <button onclick={finish} class="btn-primary inline-flex items-center justify-center gap-2">
          Перейти к меню
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    {/if}

  </div>
</div>
