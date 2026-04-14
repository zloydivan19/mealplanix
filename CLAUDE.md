@.claude/context.md

---

## Supabase

```
Project ID: hiylwwienisxynrefljz
URL:        https://hiylwwienisxynrefljz.supabase.co
Dashboard:  https://supabase.com/dashboard/project/hiylwwienisxynrefljz
Production: https://menu-plan.netlify.app
```

**Критическая логика `household_members`:**
- `own_household_id` — личное хозяйство, создаётся при регистрации, **никогда не меняется**
- `household_id` — активное хозяйство, меняется при вступлении в чужую семью
- Владелец: `household_id === own_household_id`
- Участник: `household_id !== own_household_id`

---

## Процесс разработки

1. **User Story до кода** — перед любой задачей написать US и получить явное подтверждение
2. **После завершения** — обновить `docs/backlog.md` и сохранить `docs/user-stories/us-XXX-name.md`
3. **Перед коммитом**: `pnpm check` (TS), `pnpm lint`, нет `console.log`, нет секретов в коде

---

## Response Style

- Be concise and to the point — no preamble, summaries, or unnecessary explanations
- Don't repeat what's already visible from the code or diff
- Ask clarifying questions only when truly blocked

---

## Жёсткие ограничения

- ❌ Не менять схему таблиц Supabase без явного запроса
- ❌ Не трогать `own_household_id` логику
- ❌ Не удалять и не переименовывать существующие роуты
- ❌ Не обновлять major-версии зависимостей без обсуждения
- ❌ Не использовать `any` в TypeScript
- ❌ Не хардкодить цвета — только `var(--color-*)` или Tailwind-токены
- ❌ Английский текст в UI
