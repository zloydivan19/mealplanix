# US-005 — Загрузка глобальных данных через layout

**Эпик:** Инфраструктура  
**Приоритет:** 🔴 критично  
**Статус:** ✔️ готово  
**Дата:** 2026-04-07

## Описание
Как разработчик, я хочу иметь доступ к данным текущего пользователя
(сессия, домохозяйство, персоны) в любом компоненте приложения,
чтобы не делать повторные запросы на каждой странице.

## Definition of Done
- [x] `+layout.server.ts` загружает за один запрос: session, user, household_members, household, personas
- [x] Активная персона (`persona`) — та, у которой `user_id` совпадает с текущим пользователем
- [x] `isOwner` — true если `household_id === own_household_id`
- [x] Данные доступны через `page.data` в любом компоненте (через `$app/state`)
- [x] TypeScript: все поля описаны в `App.PageData` в `src/app.d.ts`

## Архитектурное решение
**Почему `load()` в layout, а не глобальный Svelte store:**
- Глобальный `writable` store на сервере — одна переменная на всех пользователей
- При SSR разные запросы разных пользователей могут перезаписать данные друг друга
- `load()` выполняется per-request, данные изолированы

**Почему два запроса к Supabase вместо JOIN:**
- Supabase TypeScript SDK не выводит тип вложенного join автоматически → ошибка `Property does not exist on type 'never'`
- Решение: `household_members` и `households` — два отдельных запроса с явным type cast

## Затронутые файлы
- `src/routes/+layout.server.ts`
- `src/routes/+layout.ts`
- `src/routes/+layout.svelte`
- `src/app.d.ts`
