# US-BRAND — Бренд-система и визуальная идентика

**Эпик:** Инфраструктура  
**Приоритет:** 🔴 критично  
**Статус:** ✔️ готово  
**Дата:** 2026-04-08

## Описание
Как продукт, я хочу иметь единую визуальную систему на основе брендбука,
чтобы все компоненты выглядели согласованно и соответствовали фирменному стилю.

## Источник правил
`BRAND.md` в корне проекта — машиночитаемый брендбук.
Обязателен к применению при создании любого UI-компонента.

## Definition of Done
- [x] `src/routes/layout.css` — CSS-переменные бренда (`:root {}`)
- [x] Tailwind v4 токены в `@theme {}` (brand-primary, brand-soft, brand-dark, brand-orange и др.)
- [x] Inter подключён через Google Fonts
- [x] CSS-классы компонентов: `.brand-input`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`
- [x] Тёмная тема через `@media (prefers-color-scheme: dark)`
- [x] `prefers-reduced-motion` — все анимации отключаются
- [x] Focus ring: `outline: 2px solid #2E7D32; outline-offset: 2px`
- [x] Страницы `/auth` и `/onboarding` переведены на бренд-токены
- [x] Логотип: `static/logo.svg` (прозрачный SVG), favicon: `static/favicon.png`
- [x] `src/app.html` — `<link rel="icon" href="/favicon.png">`

## Ключевые токены
| Токен | Значение | Применение |
|---|---|---|
| `--color-green-primary` | `#2E7D32` | PRIMARY кнопки, активные состояния |
| `--color-green-dark` | `#1B5E20` | Hover на primary |
| `--color-orange-accent` | `#FF8F00` | Один CTA на экран |
| `--color-bg-page` | `#F7FAF7` | Фон страницы |
| `--color-bg-card` | `#FFFFFF` | Карточки, модалки |
| `--color-text-primary` | `#1F2937` | Основной текст |
| `--color-text-muted` | `#6B7280` | Подписи, плейсхолдеры |
| `--color-border` | `#E5E7EB` | Обводки, разделители |

## Запрещено (из BRAND.md)
- Хардкод цветов — только CSS-переменные или Tailwind-токены
- Фиолетовые/розовые/синие акценты
- `orange-accent` больше одного раза на экране
- `any` в TypeScript
- Английский текст в UI

## Затронутые файлы
- `src/routes/layout.css`
- `src/app.html`
- `src/routes/+layout.svelte`
- `src/routes/auth/+page.svelte`
- `src/routes/onboarding/+page.svelte`
- `static/logo.svg`, `static/favicon.png`
