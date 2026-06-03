<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getWeekDays, getWeekLabel, getWeekId } from '$lib/utils/week.js';
  import StatsChart from '$lib/components/StatsChart.svelte';
  import MacroDonut from '$lib/components/MacroDonut.svelte';
  import type { Persona } from '$lib/types/database.js';
  import type { Dish } from '$lib/types/dish.js';
  import type { PageData } from './$types.js';
  import {
    findImbalances,
    findBalancingSwaps,
    imbalancesTitle,
    metricGenitive,
    metricUnit,
    type MetricKey,
    type PlanRowLite,
    type SwapSuggestion
  } from '$lib/utils/stats-recommendations.js';

  type PlanRow = PlanRowLite & {
    persona_id: number;
    week_label: string;
  };

  import { invalidateAll } from '$app/navigation';

  let { data } = $props<{ data: PageData }>();

  // ── Навигация по неделям ──────────────────────────────────────
  let weekOffset = $state(browser ? Number(localStorage.getItem('pm_stats_week') ?? 0) : 0);
  let weekDays = $derived(getWeekDays(weekOffset));
  let weekLabel = $derived(getWeekLabel(weekDays));
  let weekId = $derived(getWeekId(weekDays));

  $effect(() => {
    if (browser) localStorage.setItem('pm_stats_week', String(weekOffset));
  });

  // ── Селектор персоны ──────────────────────────────────────────
  let personas = $derived((page.data.personas ?? []) as Persona[]);
  let activePersona = $derived(page.data.persona as Persona | null);
  let selectedPersonaId = $state<number | null>(null);
  $effect(() => {
    if (selectedPersonaId === null && activePersona) {
      selectedPersonaId = activePersona.id;
    }
  });
  let persona = $derived(personas.find((p) => p.id === selectedPersonaId) ?? activePersona);

  // ── Выбранная метрика для дневного графика ───────────────────
  let metric = $state<MetricKey>('kcal');

  const METRIC_CONFIG: Record<MetricKey, { label: string; unit: string; color: string; targetField: keyof Persona }> = {
    kcal:    { label: 'Калории', unit: 'ккал', color: '#10b981', targetField: 'kcal_target' },
    protein: { label: 'Белки',   unit: 'г',    color: '#3b82f6', targetField: 'protein_target' },
    fat:     { label: 'Жиры',    unit: 'г',    color: '#f59e0b', targetField: 'fat_target' },
    carbs:   { label: 'Углеводы',unit: 'г',    color: '#a855f7', targetField: 'carbs_target' }
  };

  // ── Фильтрованные планы текущей недели ───────────────────────
  let weekPlans = $derived(
    ((data.menuPlans ?? []) as PlanRow[]).filter(
      (p) => p.week_label === weekId && (persona ? p.persona_id === persona.id : true)
    )
  );

  // ── Агрегация по дням ────────────────────────────────────────
  const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  let dailyTotals = $derived.by(() => {
    const days: Record<number, { kcal: number; protein: number; fat: number; carbs: number }> = {};
    for (let i = 0; i < 7; i++) days[i] = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

    for (const p of weekPlans) {
      if (!days[p.day_index]) continue;
      days[p.day_index].kcal    += p.kcal    ?? 0;
      days[p.day_index].protein += p.protein ?? 0;
      days[p.day_index].fat     += p.fat     ?? 0;
      days[p.day_index].carbs   += p.carbs   ?? 0;
    }
    return days;
  });

  let dailyValues = $derived(
    Array.from({ length: 7 }, (_, i) => Math.round(dailyTotals[i][metric] * 10) / 10)
  );

  // ── Средние и сводка по всем метрикам ────────────────────────
  let weekAverages = $derived.by(() => {
    const metrics: MetricKey[] = ['kcal', 'protein', 'fat', 'carbs'];
    const result: Record<MetricKey, { avg: number; target: number; pct: number }> = {} as never;

    for (const m of metrics) {
      const nonZero = Array.from({ length: 7 }, (_, i) => dailyTotals[i][m]).filter((v) => v > 0);
      const avg = nonZero.length > 0 ? nonZero.reduce((s, v) => s + v, 0) / nonZero.length : 0;
      const target = (persona?.[METRIC_CONFIG[m].targetField] as number | null) ?? 0;
      const pct = target > 0 ? Math.round((avg / target) * 100) : 0;
      result[m] = { avg: Math.round(avg), target, pct };
    }
    return result;
  });

  // ── Adherence Score ─────────────────────────────────────────
  let adherenceScore = $derived.by(() => {
    if (!persona) return 0;
    const metrics: MetricKey[] = ['kcal', 'protein', 'fat', 'carbs'];
    const scores: number[] = [];

    for (let day = 0; day < 7; day++) {
      const dayTotal = dailyTotals[day];
      if (dayTotal.kcal === 0) continue;
      for (const m of metrics) {
        const t = persona[METRIC_CONFIG[m].targetField] as number | null;
        if (!t || t <= 0) continue;
        const dev = Math.abs(dayTotal[m] - t) / t;
        scores.push(Math.max(0, 1 - dev));
      }
    }
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100);
  });

  let adherenceColor = $derived(
    adherenceScore >= 80 ? '#10b981' : adherenceScore >= 60 ? '#f59e0b' : '#ef4444'
  );

  // ── Распределение БЖУ по калорийности (для доната) ────────
  let macroSplit = $derived.by(() => {
    const p = weekAverages.protein.avg * 4;
    const f = weekAverages.fat.avg * 9;
    const c = weekAverages.carbs.avg * 4;
    const total = p + f + c;
    if (total === 0) return { p: 0, f: 0, c: 0 };
    return {
      p: Math.round((p / total) * 100),
      f: Math.round((f / total) * 100),
      c: Math.round((c / total) * 100)
    };
  });

  // ── Распределение по приёмам пищи (% калорий) ─────────────
  type MealKey = 'bf' | 'ln' | 'dn' | 'sn';
  const MEAL_LABELS: Record<MealKey, string> = {
    bf: 'Завтрак',
    ln: 'Обед',
    dn: 'Ужин',
    sn: 'Перекус'
  };
  const MEAL_COLORS: Record<MealKey, string> = {
    bf: '#f59e0b',
    ln: '#10b981',
    dn: '#3b82f6',
    sn: '#a855f7'
  };

  let mealDistribution = $derived.by(() => {
    const totals: Record<MealKey, number> = { bf: 0, ln: 0, dn: 0, sn: 0 };
    const counts: Record<MealKey, number> = { bf: 0, ln: 0, dn: 0, sn: 0 };
    for (const p of weekPlans) {
      const key = p.meal_key as MealKey;
      if (key in totals) {
        totals[key] += p.kcal ?? 0;
        counts[key] += 1;
      }
    }
    const sum = Object.values(totals).reduce((s, v) => s + v, 0);
    return (Object.keys(totals) as MealKey[]).map((key) => ({
      key,
      label: MEAL_LABELS[key],
      color: MEAL_COLORS[key],
      kcal: Math.round(totals[key]),
      dishes: counts[key],
      avgKcal: counts[key] > 0 ? Math.round(totals[key] / counts[key]) : 0,
      pct: sum > 0 ? Math.round((totals[key] / sum) * 100) : 0
    }));
  });

  // ── Топ-5 блюд недели ────────────────────────────────────
  let topDishes = $derived.by(() => {
    type Acc = {
      count: number;
      totalKcal: number;
      totalProtein: number;
      totalFat: number;
      totalCarbs: number;
    };
    const map = new Map<string, Acc>();
    for (const p of weekPlans) {
      if (!p.dish_name) continue;
      const acc = map.get(p.dish_name) ?? {
        count: 0, totalKcal: 0, totalProtein: 0, totalFat: 0, totalCarbs: 0
      };
      acc.count += 1;
      acc.totalKcal    += p.kcal    ?? 0;
      acc.totalProtein += p.protein ?? 0;
      acc.totalFat     += p.fat     ?? 0;
      acc.totalCarbs   += p.carbs   ?? 0;
      map.set(p.dish_name, acc);
    }
    const weeklyKcalSum = weekPlans.reduce((s, p) => s + (p.kcal ?? 0), 0);
    return Array.from(map.entries())
      .map(([name, acc]) => ({
        name,
        count: acc.count,
        totalKcal:    Math.round(acc.totalKcal),
        totalProtein: Math.round(acc.totalProtein),
        totalFat:     Math.round(acc.totalFat),
        totalCarbs:   Math.round(acc.totalCarbs),
        pctOfWeek: weeklyKcalSum > 0 ? Math.round((acc.totalKcal / weeklyKcalSum) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count || b.totalKcal - a.totalKcal)
      .slice(0, 5);
  });

  // ── Заполненность недели ─────────────────────────────────
  let plannedDays = $derived(
    Array.from({ length: 7 }, (_, i) => dailyTotals[i].kcal > 0).filter(Boolean).length
  );

  let hasMenu = $derived(plannedDays > 0);

  // Текущая метрика — целевое значение для графика
  let chartTarget = $derived((persona?.[METRIC_CONFIG[metric].targetField] as number | null) ?? 0);

  // ── Рекомендации: дисбалансы + замены ───────────────────────
  let foodCatalog = $derived((page.data.foodCatalog ?? []) as Dish[]);

  let imbalances = $derived(findImbalances(weekAverages));

  // Учитываем ВСЕ дисбалансы сразу — ищем замены, которые улучшают несколько метрик
  let recommendations = $derived.by(() => {
    if (imbalances.length === 0 || foodCatalog.length === 0) return [];
    return findBalancingSwaps(imbalances, weekPlans as PlanRowLite[], foodCatalog, weekAverages, 5);
  });

  // ── Замена блюда: update menu_plans → invalidate ─────────
  let replacingIds = $state<Set<number>>(new Set());
  let balancingAll = $state(false);
  let replaceError = $state<string | null>(null);

  async function replaceDish(suggestion: SwapSuggestion): Promise<boolean> {
    if (replacingIds.has(suggestion.planId)) return false;
    replacingIds = new Set(replacingIds).add(suggestion.planId);
    replaceError = null;

    const d = suggestion.toDish;
    const g = suggestion.grams;
    const factor = g / 100;
    const update = {
      dish_name:     d.name,
      dish_category: d.category,
      dish_photo:    d.photo ?? null,
      grams:         g,
      kcal:    Math.round(d.kcal_per_100g    * factor),
      protein: Math.round(d.protein_per_100g * factor),
      fat:     Math.round(d.fat_per_100g     * factor),
      carbs:   Math.round(d.carbs_per_100g   * factor)
    };

    let success = false;
    try {
      const sb = page.data.supabase ?? (data as { supabase?: typeof page.data.supabase }).supabase;
      if (!sb) {
        throw new Error('Supabase-клиент недоступен');
      }
      const { error } = await sb.from('menu_plans').update(update).eq('id', suggestion.planId);
      if (error) {
        throw new Error(error.message);
      }
      await invalidateAll();
      success = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[stats] replace failed:', msg, { planId: suggestion.planId, update });
      replaceError = `Не удалось заменить «${suggestion.fromDishName}»: ${msg}`;
    } finally {
      const next = new Set(replacingIds);
      next.delete(suggestion.planId);
      replacingIds = next;
    }
    return success;
  }

  async function balanceAll(): Promise<void> {
    if (balancingAll) return;
    balancingAll = true;
    replaceError = null;
    // Снимаем снапшот — после invalidate список перестроится
    const snapshot = [...recommendations];
    for (const r of snapshot) {
      const ok = await replaceDish(r);
      if (!ok) break; // на первой ошибке останавливаемся
    }
    balancingAll = false;
  }

  function pctColor(pct: number): string {
    if (pct >= 95 && pct <= 105) return '#10b981'; // зелёный — почти точно
    if (pct >= 85 && pct <= 115) return '#84cc16'; // светло-зелёный — близко
    if (pct >= 70 && pct <= 130) return '#f59e0b'; // жёлтый — нужно поправить
    return '#ef4444'; // красный — далеко
  }
</script>

<svelte:head><title>Статистика — MealPlaniX</title></svelte:head>

<div class="pg">
  <!-- ═══ ШАПКА ═══ -->
  <header class="hd">
    <div class="wk-row">
      <button class="wk-btn" onclick={() => weekOffset--} aria-label="Предыдущая неделя">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="wk-center">
        <span class="wk-label">{weekLabel}</span>
        <span class="wk-sub">
          {#if weekOffset === 0}Текущая неделя
          {:else if weekOffset === 1}Следующая неделя
          {:else if weekOffset === -1}Прошлая неделя
          {:else}{weekOffset > 0 ? '+' : ''}{weekOffset} нед.
          {/if}
        </span>
      </div>
      <button class="wk-btn" onclick={() => weekOffset++} aria-label="Следующая неделя">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    {#if personas.length > 1}
      <div class="persona-row">
        {#each personas as p}
          <button
            class="persona-chip"
            class:persona-chip--active={p.id === selectedPersonaId}
            onclick={() => (selectedPersonaId = p.id)}
          >
            {p.name ?? 'Персона'}
          </button>
        {/each}
      </div>
    {/if}
  </header>

  <!-- ═══ КОНТЕНТ ═══ -->
  <div class="bd">
    {#if !persona}
      <div class="empty">
        <p class="empty-title">Нет активной персоны</p>
        <p class="empty-desc">Создайте персону в настройках, чтобы видеть статистику</p>
        <a href="/settings" class="empty-cta">Открыть настройки</a>
      </div>
    {:else if !hasMenu}
      <div class="empty">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="14" width="6" height="28" rx="2" stroke="currentColor" stroke-width="2"/>
            <rect x="18" y="22" width="6" height="20" rx="2" stroke="currentColor" stroke-width="2"/>
            <rect x="30" y="8" width="6" height="34" rx="2" stroke="currentColor" stroke-width="2"/>
          </svg>
        </div>
        <p class="empty-title">Меню на эту неделю пустое</p>
        <p class="empty-desc">Сгенерируйте меню, чтобы увидеть статистику КБЖУ</p>
        <a href="/" class="empty-cta">К планировщику</a>
      </div>
    {:else}

      <!-- ─── 1. ОБЩАЯ СВОДКА: 4 макро-карточки сразу ─── -->
      <section class="macros-grid">
        {#each (['kcal', 'protein', 'fat', 'carbs'] as MetricKey[]) as m}
          {@const w = weekAverages[m]}
          {@const conf = METRIC_CONFIG[m]}
          <div class="macro-card" style:--accent={conf.color}>
            <div class="mc-head">
              <span class="mc-label">{conf.label}</span>
              {#if w.target > 0}
                <span class="mc-pct" style:color={pctColor(w.pct)}>{w.pct}%</span>
              {:else}
                <span class="mc-pct mc-pct--off">—</span>
              {/if}
            </div>
            <div class="mc-value">
              {w.avg}<span class="mc-unit"> {conf.unit}</span>
            </div>
            {#if w.target > 0}
              <div class="mc-target">из {w.target} {conf.unit}</div>
              <div class="mc-bar">
                <div class="mc-bar-fill" style:width="{Math.min(w.pct, 100)}%" style:background={pctColor(w.pct)}></div>
              </div>
            {:else}
              <a href="/settings" class="mc-no-target">Установить цель →</a>
            {/if}
          </div>
        {/each}
      </section>

      <!-- ─── 2. ADHERENCE + ДОНАТ БЖУ ─── -->
      <section class="row-2">
        <div class="adherence-card">
          <div>
            <p class="ad-label">Соответствие цели</p>
            <p class="ad-value" style:color={adherenceColor}>{adherenceScore}%</p>
            <p class="ad-desc">
              {#if adherenceScore >= 80}Отлично! Меню точно по цели
              {:else if adherenceScore >= 60}Хорошо, есть куда расти
              {:else}Нужна корректировка
              {/if}
            </p>
          </div>
          <div class="ad-meta">
            <div class="ad-stat">
              <span class="ad-stat-val">{plannedDays}/7</span>
              <span class="ad-stat-lbl">дней спланировано</span>
            </div>
          </div>
        </div>

        <div class="donut-card">
          <p class="dc-title">Распределение БЖУ <span class="dc-sub">по калориям</span></p>
          <MacroDonut
            protein={macroSplit.p}
            fat={macroSplit.f}
            carbs={macroSplit.c}
          />
        </div>
      </section>

      <!-- ─── 3. РЕКОМЕНДАЦИИ ─── -->
      {#if imbalances.length > 0 && recommendations.length > 0}
        <section class="recs-card">
          <div class="recs-head">
            <div class="recs-icon">💡</div>
            <div class="recs-title">
              <p class="rt-main">{imbalancesTitle(imbalances)}</p>
              <p class="rt-sub">Замените блюда — недельный баланс улучшится</p>
            </div>
            <button
              type="button"
              class="btn-balance-all"
              onclick={balanceAll}
              disabled={balancingAll || recommendations.length === 0}
            >
              {#if balancingAll}
                Балансирую…
              {:else}
                Сбалансировать всё ({recommendations.length})
              {/if}
            </button>
          </div>

          {#if replaceError}
            <div class="rec-error" role="alert">{replaceError}</div>
          {/if}

          <div class="recs-list">
            {#each recommendations as r}
              {@const isReplacing = replacingIds.has(r.planId)}
              <div class="rec-item">
                <div class="rec-day">
                  <span class="rec-day-label">{r.dayLabel}</span>
                  <span class="rec-meal">{r.mealLabel}</span>
                </div>
                <div class="rec-swap">
                  <div class="rec-from">
                    <span class="rec-line-label">Сейчас:</span>
                    <span class="rec-dish">{r.fromDishName}</span>
                  </div>
                  <div class="rec-arrow">↓</div>
                  <div class="rec-to">
                    <span class="rec-line-label">Заменить на:</span>
                    <span class="rec-dish rec-dish--accent">{r.toDish.name}</span>
                  </div>
                </div>
                <div class="rec-side">
                  <div class="rec-effects">
                    {#each r.effects as eff}
                      <span
                        class="rec-effect-pill"
                        class:rec-effect-pill--down={eff.direction === 'over'}
                        class:rec-effect-pill--up={eff.direction === 'under'}
                      >
                        {eff.direction === 'over' ? '−' : '+'}{eff.improvement}{metricUnit(eff.metric)} {metricGenitive(eff.metric)}
                      </span>
                    {/each}
                  </div>
                  <button
                    type="button"
                    class="btn-replace"
                    onclick={() => replaceDish(r)}
                    disabled={isReplacing || balancingAll}
                  >
                    {#if isReplacing}
                      <svg class="spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="2" stroke-dasharray="20" stroke-linecap="round"/>
                      </svg>
                    {:else}
                      Заменить
                    {/if}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {:else if imbalances.length === 0 && hasMenu}
        <section class="recs-card recs-card--ok">
          <div class="recs-head">
            <div class="recs-icon">✓</div>
            <div class="recs-title">
              <p class="rt-main">Меню сбалансировано</p>
              <p class="rt-sub">Все КБЖУ в пределах 10% от цели — менять ничего не нужно</p>
            </div>
          </div>
        </section>
      {/if}

      <!-- ─── 4. ДНЕВНОЙ ГРАФИК С ПЕРЕКЛЮЧАТЕЛЕМ МЕТРИКИ ─── -->
      <section class="chart-section">
        <div class="metric-tabs">
          {#each Object.entries(METRIC_CONFIG) as [key, conf]}
            <button
              class="metric-tab"
              class:metric-tab--active={metric === key}
              onclick={() => (metric = key as MetricKey)}
              style:--accent={conf.color}
            >
              {conf.label}
            </button>
          {/each}
        </div>

        <div class="chart-card">
          {#key `${metric}-${weekId}-${selectedPersonaId}`}
            <StatsChart
              labels={DAY_LABELS}
              values={dailyValues}
              target={chartTarget}
              metricName={METRIC_CONFIG[metric].label}
              unit={METRIC_CONFIG[metric].unit}
              color={METRIC_CONFIG[metric].color}
            />
          {/key}
        </div>
      </section>

      <!-- ─── 4. РАСПРЕДЕЛЕНИЕ ПО ПРИЁМАМ ПИЩИ ─── -->
      <section class="meals-card">
        <p class="section-title">Калории по приёмам пищи</p>
        <div class="meals-list">
          {#each mealDistribution as m}
            <div class="meal-row">
              <div class="meal-head">
                <span class="meal-label" style:color={m.color}>● {m.label}</span>
                <span class="meal-value">
                  <strong>{m.pct}%</strong>
                  <span class="meal-divider">·</span>
                  {m.kcal} ккал
                  {#if m.dishes > 0}
                    <span class="meal-divider">·</span>
                    {m.dishes} {m.dishes === 1 ? 'блюдо' : m.dishes < 5 ? 'блюда' : 'блюд'}
                    {#if m.avgKcal > 0}
                      <span class="meal-sub">(в среднем {m.avgKcal} ккал)</span>
                    {/if}
                  {/if}
                </span>
              </div>
              <div class="meal-bar">
                <div class="meal-bar-fill" style:width="{m.pct}%" style:background={m.color}></div>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <!-- ─── 5. ТОП БЛЮД НЕДЕЛИ ─── -->
      {#if topDishes.length > 0}
        <section class="top-card">
          <p class="section-title">Топ блюд недели</p>
          <ol class="top-list">
            {#each topDishes as d, i}
              <li class="top-item">
                <span class="top-rank">{i + 1}</span>
                <div class="top-main">
                  <p class="top-name">{d.name}</p>
                  <p class="top-meta">
                    <span class="top-count-tag">{d.count}{d.count === 1 ? ' раз' : d.count < 5 ? ' раза' : ' раз'}</span>
                    <span class="top-divider">·</span>
                    <span>{d.totalKcal} ккал</span>
                    <span class="top-divider">·</span>
                    <span style="color: var(--color-macro-protein); font-weight: 600;">{d.totalProtein}г Б</span>
                    <span style="color: var(--color-macro-fat); font-weight: 600;">{d.totalFat}г Ж</span>
                    <span style="color: var(--color-macro-carbs); font-weight: 600;">{d.totalCarbs}г У</span>
                  </p>
                </div>
                <div class="top-pct">
                  <p class="top-pct-val">{d.pctOfWeek}%</p>
                  <p class="top-pct-lbl">недели</p>
                </div>
              </li>
            {/each}
          </ol>
        </section>
      {/if}

    {/if}
  </div>
</div>

<style>
  .pg {
    min-height: 100vh;
    background: var(--color-bg-page);
    display: flex;
    flex-direction: column;
  }

  /* ── HEADER ───────────────────────────────────────────────── */
  .hd {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--color-bg-card);
    border-bottom: 1px solid var(--color-border);
    padding: 12px 16px;
  }
  .wk-row {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 32px;
  }
  .wk-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-bg-page);
    color: var(--color-text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background var(--transition-fast);
  }
  .wk-btn:hover { background: var(--color-border); }
  .wk-center { flex: 1; text-align: center; min-width: 0; }
  .wk-label { font-size: 14px; font-weight: 600; color: var(--color-text-primary); display: block; }
  .wk-sub { font-size: 11px; color: var(--color-text-muted); }

  .persona-row {
    display: flex; gap: 8px; margin-top: 10px;
    overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  .persona-chip {
    flex-shrink: 0; padding: 6px 14px; font-size: 13px; font-weight: 500;
    border-radius: 999px; border: 1px solid var(--color-border);
    background: transparent; color: var(--color-text-muted); cursor: pointer;
    transition: all var(--transition-fast);
  }
  .persona-chip--active {
    background: var(--color-green-primary); color: #fff; border-color: var(--color-green-primary);
  }

  /* ── BODY ────────────────────────────────────────────────── */
  .bd {
    flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 16px;
  }
  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 12px;
  }

  /* ── 1. МАКРО-КАРТОЧКИ ───────────────────────────────── */
  .macros-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  @media (max-width: 720px) {
    .macros-grid { grid-template-columns: repeat(2, 1fr); }
  }
  .macro-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 14px 16px;
    border-left: 3px solid var(--accent);
  }
  .mc-head {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 6px;
  }
  .mc-label {
    font-size: 12px; font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .mc-pct { font-size: 13px; font-weight: 700; }
  .mc-pct--off { color: var(--color-text-muted); font-weight: 400; }
  .mc-value {
    font-size: 24px; font-weight: 700;
    color: var(--color-text-primary); line-height: 1.1;
  }
  .mc-unit {
    font-size: 13px; font-weight: 500;
    color: var(--color-text-muted);
  }
  .mc-target {
    font-size: 11px; color: var(--color-text-muted);
    margin-top: 4px;
  }
  .mc-bar {
    margin-top: 8px; height: 4px;
    background: var(--color-bg-page);
    border-radius: 4px; overflow: hidden;
  }
  .mc-bar-fill {
    height: 100%;
    transition: width 0.4s ease-out;
    border-radius: 4px;
  }
  .mc-no-target {
    display: inline-block;
    margin-top: 6px;
    font-size: 11px;
    color: #f59e0b;
    text-decoration: none;
  }
  .mc-no-target:hover { text-decoration: underline; }

  /* ── 2. ADHERENCE + DONUT ─────────────────────────────── */
  .row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 720px) {
    .row-2 { grid-template-columns: 1fr; }
  }
  .adherence-card {
    background: var(--color-green-tint);
    border: 1px solid var(--color-green-soft);
    border-radius: var(--radius-lg);
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .ad-label {
    font-size: 11px; font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .ad-value {
    font-size: 36px; font-weight: 700;
    line-height: 1.1; margin-top: 4px;
  }
  .ad-desc {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 4px;
  }
  .ad-meta { text-align: right; }
  .ad-stat { display: flex; flex-direction: column; gap: 2px; }
  .ad-stat-val { font-size: 24px; font-weight: 700; color: var(--color-text-primary); }
  .ad-stat-lbl {
    font-size: 11px; color: var(--color-text-muted);
    text-transform: uppercase; letter-spacing: 0.04em;
  }

  .donut-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 16px;
  }
  .dc-title {
    font-size: 13px; font-weight: 600;
    color: var(--color-text-primary);
  }
  .dc-sub {
    font-size: 11px; color: var(--color-text-muted);
    font-weight: 400;
  }

  /* ── 3. RECOMMENDATIONS ─────────────────────────────── */
  .recs-card {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(245, 158, 11, 0.02));
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: var(--radius-lg);
    padding: 16px;
  }
  .recs-card--ok {
    background: var(--color-green-tint);
    border-color: var(--color-green-soft);
  }
  .recs-head {
    display: flex; gap: 12px;
    align-items: flex-start;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .recs-icon {
    width: 36px; height: 36px;
    flex-shrink: 0;
    border-radius: 50%;
    background: rgba(245, 158, 11, 0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
  }
  .recs-card--ok .recs-icon {
    background: var(--color-green-soft);
    color: var(--color-green-primary);
    font-weight: 700;
    font-size: 20px;
  }
  .recs-title { flex: 1; }
  .rt-main {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1.2;
  }
  .rt-sub {
    font-size: 12px;
    color: var(--color-text-muted);
    margin-top: 2px;
  }
  .recs-list {
    display: flex; flex-direction: column;
    gap: 10px;
  }
  .rec-item {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    display: grid;
    grid-template-columns: 70px 1fr auto;
    gap: 14px;
    align-items: center;
  }
  @media (max-width: 720px) {
    .rec-item {
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .rec-side { flex-direction: row; align-items: center; justify-content: space-between; }
  }
  .rec-day {
    display: flex; flex-direction: column; align-items: flex-start;
  }
  .rec-day-label {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text-primary);
  }
  .rec-meal {
    font-size: 11px;
    color: var(--color-text-muted);
    text-transform: lowercase;
  }
  .rec-swap {
    display: flex; flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .rec-from, .rec-to {
    display: flex; align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 13px;
  }
  .rec-line-label {
    color: var(--color-text-muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .rec-dish {
    color: var(--color-text-primary);
    font-weight: 500;
  }
  .rec-dish--accent {
    color: var(--color-green-primary);
    font-weight: 600;
  }
  .rec-arrow {
    color: var(--color-text-muted);
    font-size: 14px;
    line-height: 1;
  }
  .rec-side {
    display: flex; flex-direction: column;
    align-items: flex-end; gap: 8px;
  }
  .rec-effects {
    display: flex; flex-direction: column; gap: 4px;
    align-items: flex-end;
  }
  .rec-effect-pill {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }
  .rec-effect-pill--down {
    background: rgba(34, 197, 94, 0.12);
    color: #16a34a;
  }
  .rec-effect-pill--up {
    background: rgba(59, 130, 246, 0.12);
    color: #2563eb;
  }
  .rec-error {
    margin-bottom: 12px;
    padding: 10px 14px;
    border-radius: var(--radius-md);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #b91c1c;
    font-size: 13px;
  }
  .btn-replace {
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: var(--color-green-primary);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast), opacity var(--transition-fast);
    font-family: inherit;
    min-height: 32px;
    min-width: 90px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .btn-replace:hover:not(:disabled) { background: var(--color-green-dark); }
  .btn-replace:disabled { opacity: 0.5; cursor: not-allowed; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .btn-balance-all {
    margin-left: auto;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-green-primary);
    background: var(--color-bg-card);
    border: 1px solid var(--color-green-primary);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: inherit;
    transition: background var(--transition-fast), color var(--transition-fast);
    align-self: flex-start;
    white-space: nowrap;
  }
  .btn-balance-all:hover:not(:disabled) {
    background: var(--color-green-primary);
    color: #fff;
  }
  .btn-balance-all:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── 4. CHART ─────────────────────────────────────────── */
  .chart-section { display: flex; flex-direction: column; gap: 12px; }
  .metric-tabs {
    display: flex; gap: 6px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 4px;
  }
  .metric-tab {
    flex: 1; padding: 8px 4px; font-size: 13px; font-weight: 500;
    border: none; background: transparent;
    color: var(--color-text-muted);
    border-radius: calc(var(--radius-md) - 4px);
    cursor: pointer; transition: all var(--transition-fast);
    font-family: inherit;
  }
  .metric-tab--active { background: var(--accent); color: #fff; }
  .metric-tab:not(.metric-tab--active):hover {
    background: var(--color-bg-page); color: var(--color-text-primary);
  }
  .chart-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 16px 12px 8px;
  }

  /* ── 4. MEAL DISTRIBUTION ─────────────────────────────── */
  .meals-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 16px;
  }
  .meals-list { display: flex; flex-direction: column; gap: 14px; }
  .meal-row { display: flex; flex-direction: column; gap: 6px; }
  .meal-head {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13px;
  }
  .meal-label { font-weight: 600; }
  .meal-value {
    color: var(--color-text-muted); font-size: 12px;
    display: inline-flex; align-items: baseline; gap: 6px;
  }
  .meal-value strong { color: var(--color-text-primary); font-weight: 700; font-size: 13px; }
  .meal-divider { opacity: 0.4; }
  .meal-sub { font-size: 11px; opacity: 0.7; margin-left: 2px; }
  .meal-bar {
    height: 6px;
    background: var(--color-bg-page);
    border-radius: 6px;
    overflow: hidden;
  }
  .meal-bar-fill {
    height: 100%;
    transition: width 0.4s ease-out;
    border-radius: 6px;
  }

  /* ── 5. TOP DISHES ────────────────────────────────────── */
  .top-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 16px;
  }
  .top-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .top-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px;
    background: var(--color-bg-page);
    border-radius: var(--radius-md);
  }
  .top-rank {
    width: 24px; height: 24px;
    background: var(--color-green-primary);
    color: #fff;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
    flex-shrink: 0;
  }
  .top-main { flex: 1; min-width: 0; }
  .top-name {
    font-size: 14px; font-weight: 600;
    color: var(--color-text-primary);
    line-height: 1.2;
  }
  .top-meta {
    font-size: 12px; color: var(--color-text-muted);
    margin-top: 4px;
    display: flex; align-items: baseline; gap: 6px;
    flex-wrap: wrap;
  }
  .top-divider { opacity: 0.5; }
  .top-count-tag {
    background: var(--color-green-tint);
    color: var(--color-green-primary);
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }
  .top-pct { text-align: right; }
  .top-pct-val {
    font-size: 18px; font-weight: 700;
    color: var(--color-green-primary);
    line-height: 1;
  }
  .top-pct-lbl {
    font-size: 10px; color: var(--color-text-muted);
    text-transform: uppercase; letter-spacing: 0.04em;
    margin-top: 2px;
  }

  /* ── Empty ─────────────────────────────────────────────── */
  .empty {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 48px 24px; text-align: center;
    display: flex; flex-direction: column;
    align-items: center; gap: 8px;
  }
  .empty-icon { color: var(--color-text-muted); opacity: 0.5; margin-bottom: 8px; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
  .empty-desc { font-size: 14px; color: var(--color-text-muted); line-height: 1.5; }
  .empty-cta {
    margin-top: 12px; padding: 10px 20px;
    background: var(--color-green-primary); color: #fff;
    border-radius: var(--radius-md); font-size: 14px; font-weight: 600;
    text-decoration: none; transition: background var(--transition-fast);
  }
  .empty-cta:hover { background: var(--color-green-dark); }
</style>
