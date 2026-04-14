import type { ActivityLevel, Formula, Gender } from '$lib/types/database.js';

export interface KbjuResult {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary:  1.2,
  light:      1.375,
  moderate:   1.55,
  active:     1.725,
  very_active: 1.9,
};

/**
 * Рассчитывает суточную норму КБЖУ.
 * Формула Миффлина-Сан Жеора или Харриса-Бенедикта.
 */
export function calcKbju(
  gender: Gender,
  age: number,
  weight: number,
  height: number,
  activity: ActivityLevel,
  formula: Formula,
  kcalOverride?: number | null
): KbjuResult {
  let bmr: number;

  if (formula === 'mifflin') {
    // Миффлин-Сан Жеор
    bmr = gender === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    // Харрис-Бенедикт
    bmr = gender === 'male'
      ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
      : 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;
  }

  const kcal = kcalOverride ?? Math.round(bmr * ACTIVITY_MULTIPLIERS[activity]);

  // Стандартное соотношение БЖУ: 25% белки, 30% жиры, 45% углеводы
  const protein = Math.round((kcal * 0.25) / 4);
  const fat     = Math.round((kcal * 0.30) / 9);
  const carbs   = Math.round((kcal * 0.45) / 4);

  return { kcal, protein, fat, carbs };
}

/**
 * Пересчитывает БЖУ при ручном вводе калорий.
 */
export function recalcMacros(kcal: number): KbjuResult {
  return {
    kcal,
    protein: Math.round((kcal * 0.25) / 4),
    fat:     Math.round((kcal * 0.30) / 9),
    carbs:   Math.round((kcal * 0.45) / 4),
  };
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary:   'Сидячий (офис, почти без спорта)',
  light:       'Лёгкий (1–2 тренировки в неделю)',
  moderate:    'Умеренный (3–5 тренировок в неделю)',
  active:      'Активный (6–7 тренировок в неделю)',
  very_active: 'Очень активный (физический труд + спорт)',
};
