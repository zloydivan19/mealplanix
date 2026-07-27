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
