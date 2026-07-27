# Печать меню на неделю (A4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить кнопку «Печать» в WeekGrid, которая открывает экран предпросмотра с меню недели активной персоны в печатном A4-формате (список по дням в 2 колонки + воскресенье по центру, итоги КБЖУ за день), с вызовом `window.print()`.

**Architecture:** Полностью клиентская фича, без изменений схемы БД и без новых сетевых запросов — используются уже загруженные `data.menuPlans`. Режим печати — третий локальный режим отображения в `src/routes/+page.svelte` (аналогично существующему переключателю Неделя/День), не отдельный route. Данные для печати готовит чистая функция `buildPrintDays()`, разметку рендерит новый презентационный компонент `PrintMenu.svelte`. Печатные стили — глобально в `layout.css` (`@page`, скрытие сайдбара, форс светлой темы).

**Tech Stack:** SvelteKit 2 + Svelte 5 Runes, TypeScript strict, Tailwind v4 + CSS-переменные из `layout.css`, нативный `window.print()`.

## Global Constraints

- Не менять схему таблиц Supabase.
- Не удалять и не переименовывать существующие роуты.
- Не использовать `any` в TypeScript.
- Не хардкодить цвета — только `var(--color-*)`.
- Весь текст в UI — только на русском.
- Перед каждым коммитом: `pnpm check` и `pnpm lint` должны проходить без ошибок; в новом коде — ноль `console.log`.
- **Тестирование:** в проекте нет автотестов и тестового фреймворка ни для одного модуля (проверено — `vitest`/`*.test.ts` в проекте отсутствуют). Эта фича — чисто визуальная (печатная вёрстка) и по спеке тестируется вручную. Единственная часть с чистой бизнес-логикой (`buildPrintDays`) проверяется через `pnpm check` (типы) и ручную трассировку на примере в Task 1 — заводить `vitest` ради одной функции не будем (YAGNI, следуем текущему соглашению репозитория).
- Спека: `docs/superpowers/specs/2026-07-27-print-week-menu-design.md` — при разночтениях сверяться с ней.

---

### Task 1: Утилита подготовки данных для печати

**Files:**
- Create: `src/lib/utils/print.ts`

**Interfaces:**
- Consumes: `MEAL_KEYS`, `MEAL_LABELS`, `DAY_FULL`, `type MealKey` из `src/lib/utils/week.ts` (уже существуют, см. `src/lib/utils/week.ts:1-11`).
- Produces (используется в Task 3 и Task 2):
  - `interface PrintPlanRow { persona_id: number; week_label: string; day_index: number; meal_key: string; dish_name: string; kcal: number; protein: number; fat: number; carbs: number; sort_order: number; }`
  - `interface PrintMealEntry { mealKey: MealKey; label: string; dishNames: string[]; }`
  - `interface PrintDayTotals { kcal: number; protein: number; fat: number; carbs: number; }`
  - `interface PrintDay { dayIdx: number; label: string; meals: PrintMealEntry[]; totals: PrintDayTotals | null; }`
  - `function buildPrintDays(rows: PrintPlanRow[], personaId: number, weekId: string): PrintDay[]` — всегда возвращает массив длиной ровно 7 (индексы 0..6, Пн..Вс).

`MenuPlanRow` (из `src/routes/+page.server.ts`) структурно совместим с `PrintPlanRow` — в Task 3 массив `MenuPlanRow[]` можно передавать напрямую, без преобразования.

- [ ] **Step 1: Написать файл `src/lib/utils/print.ts`**

```ts
import { MEAL_KEYS, MEAL_LABELS, DAY_FULL, type MealKey } from './week.js';

export interface PrintPlanRow {
	persona_id: number;
	week_label: string;
	day_index: number;
	meal_key: string;
	dish_name: string;
	kcal: number;
	protein: number;
	fat: number;
	carbs: number;
	sort_order: number;
}

export interface PrintMealEntry {
	mealKey: MealKey;
	label: string;
	dishNames: string[];
}

export interface PrintDayTotals {
	kcal: number;
	protein: number;
	fat: number;
	carbs: number;
}

export interface PrintDay {
	dayIdx: number;
	label: string;
	meals: PrintMealEntry[];
	totals: PrintDayTotals | null;
}

/** Готовит 7 дней (Пн..Вс) меню персоны за неделю для печатной раскладки. */
export function buildPrintDays(
	rows: PrintPlanRow[],
	personaId: number,
	weekId: string
): PrintDay[] {
	const relevant = rows.filter(
		(r) => r.persona_id === personaId && r.week_label === weekId
	);

	return Array.from({ length: 7 }, (_, dayIdx) => {
		const dayRows = relevant.filter((r) => r.day_index === dayIdx);

		if (dayRows.length === 0) {
			return { dayIdx, label: DAY_FULL[dayIdx], meals: [], totals: null };
		}

		const meals: PrintMealEntry[] = MEAL_KEYS.map((mealKey) => {
			const mealRows = dayRows
				.filter((r) => r.meal_key === mealKey)
				.sort((a, b) => a.sort_order - b.sort_order);
			return {
				mealKey,
				label: MEAL_LABELS[mealKey],
				dishNames: mealRows.map((r) => r.dish_name)
			};
		}).filter((m) => m.dishNames.length > 0);

		const rawTotals = dayRows.reduce(
			(acc, r) => ({
				kcal: acc.kcal + r.kcal,
				protein: acc.protein + r.protein,
				fat: acc.fat + r.fat,
				carbs: acc.carbs + r.carbs
			}),
			{ kcal: 0, protein: 0, fat: 0, carbs: 0 }
		);

		return {
			dayIdx,
			label: DAY_FULL[dayIdx],
			meals,
			totals: {
				kcal: Math.round(rawTotals.kcal),
				protein: Math.round(rawTotals.protein),
				fat: Math.round(rawTotals.fat),
				carbs: Math.round(rawTotals.carbs)
			}
		};
	});
}
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm check`
Expected: без новых ошибок (существующие ошибки, если есть в проекте до этой фичи, не в счёт).

- [ ] **Step 3: Ручная трассировка на примере (нет тестового фреймворка в проекте)**

Проверь вручную по коду, что для входа:
```
rows = [
  { persona_id: 1, week_label: '2026-W30', day_index: 0, meal_key: 'bf', dish_name: 'Овсянка', kcal: 320, protein: 12, fat: 8, carbs: 45, sort_order: 0 },
  { persona_id: 1, week_label: '2026-W30', day_index: 0, meal_key: 'ln', dish_name: 'Суп', kcal: 410, protein: 28, fat: 12, carbs: 40, sort_order: 0 }
]
buildPrintDays(rows, 1, '2026-W30')
```
результат — массив из 7 элементов; `[0]` содержит `label: 'Понедельник'`, `meals: [{mealKey:'bf', label:'Завтрак', dishNames:['Овсянка']}, {mealKey:'ln', label:'Обед', dishNames:['Суп']}]`, `totals: {kcal:730, protein:40, fat:20, carbs:85}`; `[1]..[6]` — `meals: []`, `totals: null`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/print.ts
git commit -m "feat: утилита подготовки данных меню для печати"
```

---

### Task 2: Компонент PrintMenu (разметка + стили)

**Files:**
- Create: `src/lib/components/PrintMenu.svelte`

**Interfaces:**
- Consumes: `Persona` из `src/lib/types/database.ts`; `PrintDay` из `src/lib/utils/print.ts` (Task 1).
- Produces: Svelte-компонент с пропсами `{ persona: Persona; weekLabel: string; days: PrintDay[]; onclose: () => void }`, используется в Task 3.

- [ ] **Step 1: Написать `src/lib/components/PrintMenu.svelte`**

```svelte
<script lang="ts">
	import type { Persona } from '$lib/types/database.js';
	import type { PrintDay } from '$lib/utils/print.js';

	let { persona, weekLabel, days, onclose }: {
		persona: Persona;
		weekLabel: string;
		days: PrintDay[];
		onclose: () => void;
	} = $props();

	const LEFT_DAYS = [0, 1, 2];
	const RIGHT_DAYS = [3, 4, 5];
	const SUNDAY_IDX = 6;

	function handlePrint() {
		window.print();
	}
</script>

{#snippet dayBlock(day: PrintDay)}
	<div class="day">
		<div class="day-name">{day.label}</div>
		{#if day.meals.length === 0}
			<p class="day-empty">День не запланирован</p>
		{:else}
			{#each day.meals as meal (meal.mealKey)}
				<p class="meal-line"><span class="meal-label">{meal.label}:</span> {meal.dishNames.join(', ')}</p>
			{/each}
			{#if day.totals}
				<p class="day-totals">{day.totals.kcal} ккал · Б{day.totals.protein} Ж{day.totals.fat} У{day.totals.carbs}</p>
			{/if}
		{/if}
	</div>
{/snippet}

<div class="print-toolbar">
	<button type="button" class="back-btn" onclick={onclose}>← Назад к меню</button>
	<button type="button" class="print-btn" onclick={handlePrint}>🖨 Распечатать</button>
</div>

<div class="print-sheet">
	<div class="brand">
		<img src="/logo1.jpg" alt="" class="brand-logo" />
		<span class="brand-name"><span class="brand-main">MealPlani</span><span class="brand-accent">X</span></span>
	</div>
	<h2 class="sheet-title">Меню на неделю</h2>
	<p class="sheet-subtitle">{weekLabel} · {persona.name}</p>

	<div class="days-grid">
		<div class="days-col">
			{#each LEFT_DAYS as idx (idx)}
				{@render dayBlock(days[idx])}
			{/each}
		</div>
		<div class="days-col">
			{#each RIGHT_DAYS as idx (idx)}
				{@render dayBlock(days[idx])}
			{/each}
		</div>
	</div>

	<div class="sunday-block">
		{@render dayBlock(days[SUNDAY_IDX])}
	</div>

	<p class="sheet-footer">Mealplanix · сгенерировано {new Date().toLocaleDateString('ru-RU')}</p>
</div>

<style>
	.print-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		max-width: 210mm;
		margin: 0 auto 16px;
		padding: 0 16px;
	}
	.back-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		padding: 8px 0;
	}
	.print-btn {
		background: var(--color-green-primary);
		color: var(--color-text-inverse);
		border: none;
		border-radius: var(--radius-md);
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.print-btn:hover {
		background: var(--color-green-dark);
	}

	.print-sheet {
		width: 210mm;
		min-height: 297mm;
		margin: 0 auto 40px;
		padding: 12mm;
		background: var(--color-bg-card);
		box-shadow: var(--shadow-modal);
		box-sizing: border-box;
	}

	.brand {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-bottom: 4px;
	}
	.brand-logo {
		height: 28px;
		width: 28px;
		object-fit: contain;
		border-radius: 6px;
		mix-blend-mode: multiply;
	}
	.brand-name {
		font-size: 16px;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.brand-main {
		color: var(--color-text-primary);
	}
	.brand-accent {
		color: var(--color-green-primary);
	}

	.sheet-title {
		text-align: center;
		font-size: 15px;
		font-weight: 700;
		color: var(--color-text-primary);
		margin: 4px 0 2px;
	}
	.sheet-subtitle {
		text-align: center;
		font-size: 11px;
		color: var(--color-text-muted);
		margin: 0 0 14px;
	}

	.days-grid {
		display: flex;
		gap: 16px;
	}
	.days-col {
		flex: 1;
		min-width: 0;
	}

	.day {
		margin-bottom: 8px;
		padding-top: 6px;
		border-top: 1px dotted var(--color-border);
	}
	.day:first-child {
		padding-top: 0;
		border-top: none;
	}
	.day-name {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-text-primary);
		margin-bottom: 2px;
	}
	.meal-line {
		font-size: 10.5px;
		line-height: 1.4;
		color: var(--color-text-primary);
		margin: 0;
	}
	.meal-label {
		color: var(--color-text-muted);
	}
	.day-empty {
		font-size: 10.5px;
		color: var(--color-text-muted);
		margin: 0;
	}
	.day-totals {
		font-size: 9px;
		color: var(--color-text-muted);
		text-align: right;
		margin: 2px 0 0;
	}

	.sunday-block {
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px dotted var(--color-border);
		max-width: 70%;
		margin-left: auto;
		margin-right: auto;
		text-align: center;
	}
	.sunday-block :global(.day-name),
	.sunday-block :global(.meal-line),
	.sunday-block :global(.day-totals),
	.sunday-block :global(.day-empty) {
		text-align: center;
	}

	.sheet-footer {
		text-align: center;
		font-size: 8px;
		color: var(--color-text-muted);
		margin-top: 14px;
		padding-top: 8px;
		border-top: 1px solid var(--color-border);
	}

	@media print {
		.print-toolbar {
			display: none;
		}
		.print-sheet {
			box-shadow: none;
			margin: 0;
			width: auto;
			min-height: auto;
		}
	}
</style>
```

- [ ] **Step 2: Проверить типы и линт**

Run: `pnpm check && pnpm lint`
Expected: без новых ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/PrintMenu.svelte
git commit -m "feat: компонент печатного макета меню недели"
```

---

### Task 3: Подключение к WeekGrid — кнопка «Печать» и режим предпросмотра

**Files:**
- Modify: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: `PrintMenu` (Task 2), `buildPrintDays` + `PrintDay` (Task 1), уже существующие `activePersona`, `weekLabel`, `weekId`, `data.menuPlans` (`MenuPlanRow[]`, см. `src/routes/+page.server.ts:3-19`).
- Produces: ничего нового для других задач — терминальная задача по коду.

- [ ] **Step 1: Добавить импорты**

В `src/routes/+page.svelte` после строки `import { browser } from '$app/environment';` (строка 31) добавить:

```ts
import PrintMenu from '$lib/components/PrintMenu.svelte';
import { buildPrintDays } from '$lib/utils/print.js';
```

- [ ] **Step 2: Добавить состояние режима печати**

Найти блок объявления `viewMode`/`viewDayIdx` (строки 36-42):

```ts
	// ── Режим просмотра (persist через localStorage) ──────────────────────
	type ViewMode = 'week' | 'day';
	let viewMode = $state<ViewMode>(
		browser && localStorage.getItem('pm_view') === 'day' ? 'day' : 'week'
	);
	let viewDayIdx = $state(
		browser ? Math.max(0, Math.min(6, Number(localStorage.getItem('pm_day') ?? 0))) : 0
	);
```

Сразу после этого блока (перед `// ── Навигация по неделям`) добавить:

```ts

	// ── Режим печати ────────────────────────────────────────────────────
	let printMode = $state(false);
```

- [ ] **Step 3: Добавить производные данные для печати**

Найти блок (текущие строки 104-110):

```ts
	// ── Персоны ───────────────────────────────────────────────────────────
	let personas = $derived(page.data.personas as Persona[]);
	let activeId = $state<number>(page.data.persona?.id ?? 0);
	let activePersona = $derived(personas.find((p) => p.id === activeId) ?? personas[0]);
	// true только если активная персона принадлежит собственному хозяйству текущего пользователя
	let canEdit = $derived(
		!!activePersona && activePersona.household_id === page.data.ownHouseholdId
	);
```

Сразу после этого блока добавить:

```ts

	let printDays = $derived(
		activePersona
			? buildPrintDays(data.menuPlans as MenuPlanRow[], activePersona.id, weekId)
			: []
	);
```

Размещаем после `activePersona`, по аналогии с уже существующим `canEdit` — оба производных значения зависят от `activePersona` и объявлены сразу за ним.

- [ ] **Step 4: Добавить кнопку «Печать» в тулбар**

Найти закрытие блока генерации (текущие строки 1608-1696), заканчивающееся на:

```svelte
			<!-- Кнопка генерации (split) -->
			{#if canEdit}
			<div class="relative flex" style="gap: 2px;">
			<!-- ...весь существующий блок до его {/if}... -->
```

Сразу после `{/if}`, которым заканчивается блок `<!-- Кнопка генерации (split) -->` (это `{/if}` непосредственно перед закрывающим `</div>` всего правого блока тулбара — в исходном файле это строка 1696, после неё идёт `</div>` строки 1697 и `</div>` строки 1698), вставить новую кнопку:

```svelte

			<!-- Кнопка «Печать» -->
			<button
				type="button"
				onclick={() => (printMode = true)}
				disabled={!activePersona}
				class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
				style="
					background: var(--color-bg-page);
					border: 1px solid var(--color-border);
					color: var(--color-text-muted);
					opacity: {activePersona ? '1' : '0.5'};
				"
				onmouseenter={(e) => {
					(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-green-soft)';
					(e.currentTarget as HTMLElement).style.color = 'var(--color-green-primary)';
				}}
				onmouseleave={(e) => {
					(e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
					(e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)';
				}}
				aria-label="Печать меню"
			>
				🖨 Печать
			</button>
```

Кнопка ставится вне `{#if canEdit}` — печатать может и участник домохозяйства без прав редактирования (просматривающий чужое меню).

- [ ] **Step 5: Обернуть основной контент условием printMode**

Найти открытие корневого `<div>` (текущая строка 1143):

```svelte
<div class="flex min-h-screen flex-col" style="background: var(--color-bg-page);">
	<!-- ── Переключатель персон ────────────────────────────────────────── -->
```

Заменить на:

```svelte
<div class="flex min-h-screen flex-col" style="background: var(--color-bg-page);">
	{#if printMode && activePersona}
		<PrintMenu
			persona={activePersona}
			weekLabel={weekLabel}
			days={printDays}
			onclose={() => (printMode = false)}
		/>
	{:else}
	<!-- ── Переключатель персон ────────────────────────────────────────── -->
```

Найти закрытие корневого `<div>` в самом конце DayView-блока (текущие строки 2412-2413):

```svelte
	{/if}
</div>

{#if fridgeModalOpen}
```

Заменить на:

```svelte
	{/if}
	{/if}
</div>

{#if fridgeModalOpen}
```

(Первый `{/if}` — существующий, закрывает `{#if viewMode === 'day'}`; второй — новый, закрывает добавленный на Step 5 `{#if printMode && activePersona}`.)

- [ ] **Step 6: Проверить типы и линт**

Run: `pnpm check && pnpm lint`
Expected: без новых ошибок.

- [ ] **Step 7: Запустить dev-сервер и проверить визуально**

Run: `pnpm dev`

Открыть `/`, нажать «🖨 Печать» в шапке — должен открыться экран предпросмотра с блюдами текущей недели активной персоны, без сайдбара и шапки WeekGrid. Кнопка «← Назад к меню» должна возвращать в обычный режим.

- [ ] **Step 8: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: кнопка печати меню и режим предпросмотра в WeekGrid"
```

---

### Task 4: Глобальные печатные стили (A4, скрытие сайдбара, форс светлой темы)

**Files:**
- Modify: `src/routes/layout.css`

**Interfaces:**
- Consumes: существующие CSS-переменные и класс `.sb-panel` (сайдбар, `src/lib/components/Sidebar.svelte`), класс `.layout-wrap` (`src/routes/+layout.svelte:61,70-84`).
- Produces: ничего для других задач — терминальная задача.

- [ ] **Step 1: Дописать в конец `src/routes/layout.css`**

```css

/* ─── Печать меню недели (PrintMenu) ────────────────────────────────── */
@page {
	size: A4;
	margin: 12mm;
}

@media print {
	.sb-panel {
		display: none;
	}

	.layout-wrap {
		margin-left: 0;
	}

	:root,
	:root[data-theme='dark'] {
		--color-bg-page: #f3f6f0;
		--color-bg-card: #fafcf9;
		--color-text-primary: #17201a;
		--color-text-muted: #6b7568;
		--color-border: #dde3d8;
	}
}
```

Правило `:root, :root[data-theme='dark']` идёт позже в файле, чем блок тёмной темы (`:root[data-theme='dark']` определён выше, см. `src/routes/layout.css:227-232`), поэтому при печати переопределяет его за счёт порядка следования правил (равная специфичность — побеждает последнее объявленное).

- [ ] **Step 2: Проверить линт**

Run: `pnpm lint`
Expected: без новых ошибок (prettier может потребовать форматирования — если так, применить `pnpm exec prettier --write src/routes/layout.css` и перепроверить).

- [ ] **Step 3: Commit**

```bash
git add src/routes/layout.css
git commit -m "feat: печатные CSS-стили — A4, скрытие сайдбара, форс светлой темы"
```

---

### Task 5: Ручная сквозная проверка (acceptance)

**Files:** нет изменений кода — только проверка уже реализованного.

- [ ] **Step 1: Подготовить тестовые данные**

Запустить `pnpm dev`, открыть `/`. Убедиться, что у активной персоны на текущей неделе заполнено несколько дней (минимум один день с 2+ блюдами в одном приёме пищи — для проверки склейки через запятую), а минимум один день оставить полностью пустым.

- [ ] **Step 2: Проверить базовый сценарий печати**

Нажать «🖨 Печать». Проверить:
- Шапка: логотип + «MealPlaniX» по центру, ниже «Меню на неделю» и период + имя персоны.
- Пн–Ср слева, Чт–Сб справа, Вс — по центру снизу.
- Для пустого дня — текст «День не запланирован» вместо пустых строк приёмов.
- Для дня с 2+ блюдами в одном приёме — блюда через запятую в одной строке.
- Итог дня — одна строка мелким текстом «XXXX ккал · БXX ЖXX УXX» под приёмами пищи (кроме пустых дней).

- [ ] **Step 3: Проверить предпросмотр печати браузера**

Нажать «🖨 Распечатать» → открыть системный диалог печати браузера (Ctrl+P), убедиться, что:
- Сайдбар и кнопки «Назад»/«Распечатать» не попадают на лист.
- Вся неделя помещается на один лист A4.
- Поля страницы ~12мм.

- [ ] **Step 4: Проверить тёмную тему**

Переключить тему приложения в тёмную (иконка в сайдбаре) → открыть печать (Ctrl+P) → убедиться, что предпросмотр печати светлый (белый фон, тёмный текст), независимо от темы интерфейса.

- [ ] **Step 5: Проверить edge-кейсы**

- Персона с длинным именем (например, тестово переименовать в настройках в «Александра Владимировна») — не ломает вёрстку шапки.
- Блюдо с длинным названием — переносится по словам, не вылезает за колонку.
- Переключение персоны на вкладке над WeekGrid → повторное открытие печати → печатается меню новой активной персоны, а не предыдущей.
- Переключение недели (стрелки ← →) → повторное открытие печати → печатается выбранная неделя.

- [ ] **Step 6: Доложить пользователю результат**

Сообщить, какие сценарии проверены и что видно в предпросмотре. Дальнейшие правки — по обратной связи пользователя. **Пуш в git — только по отдельной явной команде пользователя** (см. процесс разработки в CLAUDE.md).
