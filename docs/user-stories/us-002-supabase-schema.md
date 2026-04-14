# US-002 — Схема базы данных и Supabase-клиент

**Эпик:** Инфраструктура  
**Приоритет:** 🔴 критично  
**Статус:** ✔️ готово  
**Дата:** 2026-04-07

## Описание
Как разработчик, я хочу иметь готовую схему БД и типизированный Supabase-клиент,
чтобы все запросы к данным были безопасными и предсказуемыми.

## Контекст
Новая БД — без миграции данных из v4. Чистый старт.
RLS включён на всех таблицах. Каждый пользователь видит только свои данные.

## Definition of Done
- [x] `docs/schema-v5.sql` — 9 таблиц с RLS и индексами
- [x] Trigger `handle_new_user`: при регистрации → profiles → households → household_members
- [x] Invite code генерируется автоматически (формат ABCDE-1X2Y)
- [x] `src/lib/types/database.ts` — TypeScript-интерфейсы для всех таблиц
- [x] `src/lib/api/supabase.ts` — `createSupabaseBrowserClient()` и `createSupabaseServerClient()`
- [x] `src/hooks.server.ts` — per-request Supabase клиент + `safeGetSession()` через `getUser()`
- [x] `src/app.d.ts` — типы `App.Locals` и `App.PageData`

## Таблицы
| Таблица | Назначение |
|---|---|
| `profiles` | Публичный профиль пользователя |
| `households` | Домохозяйство (семья) |
| `household_members` | Участники домохозяйства |
| `personas` | Персоны с биопараметрами и КБЖУ |
| `menu_plans` | Слоты меню (персона × неделя × день × приём) |
| `custom_dishes` | Кастомные блюда домохозяйства |
| `custom_products` | Кастомные продукты |
| `household_fridge` | Инвентарь холодильника |
| `household_join_requests` | Заявки на вступление |

## Архитектурное решение
- `own_household_id` vs `household_id` — владелец создаёт семью, участники вступают в чужую
- `meal_ratios jsonb` в `personas` — распределение калорий по приёмам (bf/ln/dn), дефолт 25/40/35
- Индекс `idx_menu_plans_persona_week` — оптимизация частого запроса по персоне + неделе

## Затронутые файлы
- `docs/schema-v5.sql`
- `src/lib/types/database.ts`
- `src/lib/api/supabase.ts`
- `src/hooks.server.ts`
- `src/app.d.ts`
