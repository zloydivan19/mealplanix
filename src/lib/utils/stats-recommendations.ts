import type { Dish } from '$lib/types/dish.js';

export type MetricKey = 'kcal' | 'protein' | 'fat' | 'carbs';

export interface PlanRowLite {
	id:            number;
	day_index:     number;
	meal_key:      string;
	dish_name:     string;
	dish_category: string | null;
	grams:         number;
	kcal:          number;
	protein:       number;
	fat:           number;
	carbs:         number;
}

export interface Imbalance {
	metric:    MetricKey;
	deltaPct:  number;          // % отклонения от цели (− = недобор, + = перебор)
	deltaAbs:  number;          // абс. отклонение средн./день
	severity:  'high' | 'medium';
	direction: 'over' | 'under';
}

export interface SwapEffect {
	metric:      MetricKey;
	direction:   'over' | 'under';
	improvement: number;        // насколько улучшит метрику (всегда положительное)
}

export interface SwapSuggestion {
	planId:        number;
	grams:         number;
	dayIdx:        number;
	dayLabel:      string;
	mealKey:       string;
	mealLabel:     string;
	fromDishName:  string;
	toDish:        Dish;
	effects:       SwapEffect[];   // улучшения по ВСЕМ дисбалансным метрикам
	totalScore:    number;          // суммарная нормализованная польза
}

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MEAL_LABELS: Record<string, string> = {
	bf: 'завтрак',
	ln: 'обед',
	dn: 'ужин',
	sn: 'перекус'
};

const METRIC_PER_100G: Record<MetricKey, keyof Pick<Dish, 'kcal_per_100g' | 'protein_per_100g' | 'fat_per_100g' | 'carbs_per_100g'>> = {
	kcal:    'kcal_per_100g',
	protein: 'protein_per_100g',
	fat:     'fat_per_100g',
	carbs:   'carbs_per_100g'
};

// ── Найти дисбалансы недели ────────────────────────────────
export function findImbalances(
	weekAverages: Record<MetricKey, { avg: number; target: number }>
): Imbalance[] {
	const result: Imbalance[] = [];
	const metrics: MetricKey[] = ['kcal', 'protein', 'fat', 'carbs'];

	for (const metric of metrics) {
		const { avg, target } = weekAverages[metric];
		if (target <= 0 || avg === 0) continue;
		const deltaPct = ((avg - target) / target) * 100;
		const absPct = Math.abs(deltaPct);
		if (absPct < 10) continue;

		result.push({
			metric,
			deltaPct,
			deltaAbs: Math.round(avg - target),
			severity: absPct > 20 ? 'high' : 'medium',
			direction: deltaPct > 0 ? 'over' : 'under'
		});
	}

	return result.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
}

// ── Найти умные замены, которые улучшают СРАЗУ несколько метрик ─
export function findBalancingSwaps(
	imbalances: Imbalance[],
	weekPlans: PlanRowLite[],
	catalog: Dish[],
	weekAverages: Record<MetricKey, { avg: number; target: number }>,
	maxResults = 5
): SwapSuggestion[] {
	if (imbalances.length === 0 || catalog.length === 0 || weekPlans.length === 0) return [];

	const allCandidates: SwapSuggestion[] = [];

	for (const plan of weekPlans) {
		if (!plan.dish_category) continue;
		const grams = plan.grams || 200;

		const sameCategory = catalog.filter(
			(d) =>
				d.category === plan.dish_category &&
				d.name !== plan.dish_name &&
				d.kcal_per_100g > 0
		);

		for (const candidate of sameCategory) {
			const candKcal    = (candidate.kcal_per_100g    * grams) / 100;
			const candProtein = (candidate.protein_per_100g * grams) / 100;
			const candFat     = (candidate.fat_per_100g     * grams) / 100;
			const candCarbs   = (candidate.carbs_per_100g   * grams) / 100;

			// Не ломаем калорийность дня — допуск ±25% по ккал блюда
			if (plan.kcal > 0 && Math.abs(candKcal - plan.kcal) / plan.kcal > 0.25) continue;

			const candValues: Record<MetricKey, number> = {
				kcal: candKcal, protein: candProtein, fat: candFat, carbs: candCarbs
			};
			const planValues: Record<MetricKey, number> = {
				kcal: plan.kcal, protein: plan.protein, fat: plan.fat, carbs: plan.carbs
			};

			// Считаем effects для каждой дисбалансной метрики
			const effects: SwapEffect[] = [];
			let totalScore = 0;
			let hurtsAnyMetric = false;

			for (const im of imbalances) {
				const t = weekAverages[im.metric].target;
				if (t <= 0) continue;
				const planV = planValues[im.metric];
				const candV = candValues[im.metric];
				const diff  = candV - planV; // изменение метрики

				if (im.direction === 'over') {
					// нужно снизить → diff должен быть отрицательным
					if (diff < 0) {
						const improvement = -diff;
						effects.push({
							metric: im.metric,
							direction: im.direction,
							improvement: Math.round(improvement * 10) / 10
						});
						// нормализуем improvement относительно target дневной нормы
						totalScore += (improvement / t) * Math.min(Math.abs(im.deltaPct), 50);
					} else if (diff > planV * 0.15) {
						// замена сильно УХУДШАЕТ метрику где и так перебор → пропускаем кандидата
						hurtsAnyMetric = true;
					}
				} else {
					// under: нужно повысить → diff должен быть положительным
					if (diff > 0) {
						const improvement = diff;
						effects.push({
							metric: im.metric,
							direction: im.direction,
							improvement: Math.round(improvement * 10) / 10
						});
						totalScore += (improvement / t) * Math.min(Math.abs(im.deltaPct), 50);
					} else if (-diff > planV * 0.15) {
						hurtsAnyMetric = true;
					}
				}
			}

			if (hurtsAnyMetric || effects.length === 0) continue;
			if (totalScore < 0.05) continue; // незначительное улучшение

			allCandidates.push({
				planId: plan.id,
				grams,
				dayIdx: plan.day_index,
				dayLabel: DAY_LABELS[plan.day_index] ?? '',
				mealKey:  plan.meal_key,
				mealLabel: MEAL_LABELS[plan.meal_key] ?? plan.meal_key,
				fromDishName: plan.dish_name,
				toDish: candidate,
				effects,
				totalScore
			});
		}
	}

	// Сортируем по totalScore и дедуплицируем по planId (одну замену на блюдо)
	allCandidates.sort((a, b) => b.totalScore - a.totalScore);
	const usedPlans = new Set<number>();
	const result: SwapSuggestion[] = [];
	for (const c of allCandidates) {
		if (usedPlans.has(c.planId)) continue;
		usedPlans.add(c.planId);
		result.push(c);
		if (result.length >= maxResults) break;
	}
	return result;
}

// ── Локализация ─────────────────────────────────────────────
export function metricGenitive(metric: MetricKey): string {
	const map: Record<MetricKey, string> = {
		kcal:    'калорий',
		protein: 'белка',
		fat:     'жиров',
		carbs:   'углеводов'
	};
	return map[metric];
}

export function metricUnit(metric: MetricKey): string {
	return metric === 'kcal' ? 'ккал' : 'г';
}

export function imbalancesTitle(imbalances: Imbalance[]): string {
	if (imbalances.length === 0) return '';
	if (imbalances.length === 1) {
		const im = imbalances[0];
		const sign = im.deltaPct > 0 ? '+' : '−';
		const pct  = Math.abs(Math.round(im.deltaPct));
		const verb = im.direction === 'over' ? 'Перебор' : 'Недобор';
		return `${verb} ${metricGenitive(im.metric)}: ${sign}${pct}% от цели`;
	}
	const parts = imbalances.map((im) => {
		const sign = im.deltaPct > 0 ? '+' : '−';
		return `${sign}${Math.abs(Math.round(im.deltaPct))}% ${metricGenitive(im.metric)}`;
	});
	return `Найдены отклонения: ${parts.join(', ')}`;
}
