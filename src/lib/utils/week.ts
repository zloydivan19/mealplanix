const DAY_SHORT  = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_FULL   = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export const MEAL_LABELS: Record<string, string> = {
  bf: 'Завтрак',
  ln: 'Обед',
  dn: 'Ужин',
  sn: 'Перекус',
};
export const MEAL_KEYS = ['bf', 'ln', 'dn', 'sn'] as const;
export type MealKey = typeof MEAL_KEYS[number];

/** Возвращает понедельник недели для заданной даты */
function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Возвращает 7 дат (Пн–Вс) для недели с заданным смещением от текущей */
export function getWeekDays(offset: number): Date[] {
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Метка вида "14 апр – 20 апр" */
export function getWeekLabel(days: Date[]): string {
  const s = days[0];
  const e = days[6];
  const fmt = (d: Date) => `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  return `${fmt(s)} – ${fmt(e)}`;
}

/** Идентификатор недели для БД, вида "2026-W15" */
export function getWeekId(days: Date[]): string {
  const d = new Date(days[0]);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
  return `${days[0].getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Проверяет, является ли дата сегодняшней */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate()     === today.getDate()  &&
    date.getMonth()    === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export { DAY_SHORT, DAY_FULL, MONTH_SHORT };
