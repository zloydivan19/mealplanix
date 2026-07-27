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
		<span class="brand-spacer" aria-hidden="true"></span>
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
		padding: 14mm;
		background: var(--color-bg-card);
		box-shadow: var(--shadow-modal);
		box-sizing: border-box;
	}

	.brand {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 8px;
	}
	.brand-logo {
		height: 34px;
		width: 34px;
		object-fit: contain;
		border-radius: 7px;
		mix-blend-mode: multiply;
	}
	.brand-spacer {
		width: 34px;
	}
	.brand-name {
		font-size: 19px;
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
		font-size: 18px;
		font-weight: 700;
		color: var(--color-text-primary);
		margin: 4px 0 4px;
	}
	.sheet-subtitle {
		text-align: center;
		font-size: 13px;
		color: var(--color-text-muted);
		margin: 0 0 18px;
	}

	.days-grid {
		display: flex;
		gap: 22px;
	}
	.days-col {
		flex: 1;
		min-width: 0;
	}

	.day {
		margin-bottom: 12px;
		padding-top: 9px;
		border-top: 1px dotted var(--color-border);
	}
	.day:first-child {
		padding-top: 0;
		border-top: none;
	}
	.day-name {
		font-size: 14.5px;
		font-weight: 700;
		color: var(--color-text-primary);
		margin-bottom: 4px;
	}
	.meal-line {
		font-size: 12.5px;
		line-height: 1.45;
		color: var(--color-text-primary);
		margin: 0 0 2px;
	}
	.meal-label {
		color: var(--color-text-muted);
	}
	.day-empty {
		font-size: 12.5px;
		color: var(--color-text-muted);
		margin: 0;
	}
	.day-totals {
		font-size: 11px;
		color: var(--color-text-muted);
		text-align: right;
		margin: 4px 0 0;
	}

	.sunday-block {
		margin-top: 14px;
		padding-top: 11px;
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
		font-size: 9.5px;
		color: var(--color-text-muted);
		margin-top: 16px;
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
