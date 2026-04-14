# PlanMeal v5 — Project Context

## Purpose
Weekly meal planner for Russian-speaking families (CIS): household → personas → week menu → shopping cart → fridge inventory.

## Tech Stack
SvelteKit 2 + Svelte 5 Runes · Tailwind CSS v4 + CSS vars (`src/routes/layout.css`) · Supabase (Auth + PostgreSQL + RLS) · Netlify adapter · TypeScript strict · pnpm

## Routes

| Route | Description |
|---|---|
| `/` | Main planner: week grid + day view, persona tabs |
| `/auth` | Login / Register |
| `/onboarding` | New user setup: household, personas, KBJU |
| `/dishes` | Custom dish library + FatSecret search |
| `/fridge` | Fridge inventory (row-per-item) |
| `/cart` | Shopping list from week menu |
| `/settings` | Persona KBJU settings, household management |
| `/api/*` | Server-side routes (FatSecret proxy) |

## Key Files
- `src/hooks.server.ts` — Supabase session + auth middleware
- `src/routes/+layout.svelte` — Sidebar + content slot
- `src/routes/layout.css` — all CSS design tokens
- `src/lib/api/supabase.ts` — Supabase client (SSR + browser)
- `src/lib/types/database.ts` — all DB row types + Supabase Database interface
- `src/lib/types/dish.ts` — Dish, DishCategory, ShoppingCategory

## Database (Supabase + RLS)

| Table | Key columns |
|---|---|
| `profiles` | `id` (= auth.uid) |
| `households` | `id`, `invite_code` |
| `household_members` | `user_id`, `household_id`, `own_household_id` |
| `personas` | `household_id`, KBJU targets, `meal_ratios` (JSONB) |
| `menu_plans` | `persona_id`, `week_label`, `day_index`, `meal_key`, `dish_name`, KBJU cols |
| `custom_dishes` | `household_id`, `data` (JSONB) |
| `custom_products` | `household_id`, `data` (JSONB) |
| `household_fridge` | `id` (GENERATED ALWAYS AS IDENTITY), `household_id`, `product_name`, `qty`, `unit`, `expires_at` |
| `household_join_requests` | `household_id`, `requester_user_id`, `status` |

## Svelte Rules
- Runes only: `$state`, `$derived`, `$effect`, `$props`
- `{@const}` — only direct child of `{#each}` / `{#if}` / `{:else}`, never inside HTML tags
- Dark mode: `data-theme="dark"` on `<html>`
- Sidebar: collapsed=64px / expanded=220px via `var(--sb-w)`
- Page headers: all pages — 56px sticky bar (matches sidebar header)
- **SSR + localStorage**: если страница читает `localStorage` в `$state()` инициализаторе — обязателен `+page.ts` с `export const ssr = false`. Без этого SSR рендерит с дефолтным значением, клиент гидрирует с localStorage-значением → flash. Пример: `/` и `/cart`.
