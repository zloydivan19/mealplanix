# PlanMeal v5 — Документация проекта

**Версия документа:** 2026-04-13  
**Статус:** актуально

---

## Что такое PlanMeal

PlanMeal — веб-приложение для планирования питания семьи на неделю.

**Что делает:**
- Генерирует меню на 7 дней по заданной норме КБЖУ
- Ведёт список покупок с ценами и чекбоксами
- Учитывает остатки из холодильника при формировании корзины
- Поддерживает несколько персон в одном домохозяйстве (семья)
- Позволяет добавлять свои блюда с ингредиентами и граммовками

**Хостинг:** Netlify — https://menu-plan.netlify.app  
**База данных:** Supabase (PostgreSQL + Auth)

---

## Технологический стек

| Слой | Технология | Версия |
|------|-----------|--------|
| Фреймворк | SvelteKit 2 | ^2.50 |
| Язык | Svelte 5 (Runes) | ^5.54 |
| Типизация | TypeScript | ^5.9 |
| Стили | Tailwind CSS 4 | ^4.1 |
| БД + Auth | Supabase | ^2.102 |
| Деплой | @sveltejs/adapter-netlify | ^5.2 |
| Сборщик | Vite | ^7.3 |

**Ключевые особенности Svelte 5 Runes:**
- `$state()` — реактивные переменные
- `$derived()` / `$derived.by()` — вычисляемые значения
- `$props()` — пропсы компонентов
- `$effect()` — сайд-эффекты
- `{@const}` — локальные переменные только внутри `{#each}`, `{#if}`, `{#snippet}`

---

## Структура файлов

```
src/
├── app.d.ts                         # TypeScript типы для SvelteKit (locals)
├── app.html                         # HTML шаблон
├── hooks.server.ts                  # Auth middleware: safeGetSession, Supabase client
│
├── lib/
│   ├── api/
│   │   └── supabase.ts              # Создание Supabase клиента для браузера
│   ├── components/
│   │   ├── Sidebar.svelte           # Навигационная панель (сворачиваемая)
│   │   ├── MealCard.svelte          # Карточка блюда в слоте меню
│   │   ├── MealModal.svelte         # Модалка добавления/замены блюда
│   │   └── DishDetailModal.svelte   # Карточка блюда при клике (ингредиенты, КБЖУ)
│   ├── data/
│   │   └── ingredient-dictionary.ts # Словарь ингредиентов → автодетект категории
│   ├── types/
│   │   ├── dish.ts                  # Единый тип Dish, DishIngredient, ShoppingCategory
│   │   └── database.ts              # Типы таблиц БД, FridgeRow, CustomDish и т.д.
│   └── utils/
│       ├── generate.ts              # Алгоритм генерации меню на неделю
│       ├── ingredients.ts           # Агрегация ингредиентов для корзины
│       ├── detectIngredientCategory.ts # Автоопределение категории по названию
│       ├── kbju.ts                  # Расчёт КБЖУ по формулам Миффлина/Харриса
│       └── week.ts                  # Утилиты для работы с неделями (ISO)
│
└── routes/
    ├── +layout.server.ts            # Глобальная загрузка данных (auth, personas, catalog, fridge)
    ├── +layout.svelte               # Обёртка: Sidebar + floating кнопка "Выйти"
    ├── +layout.ts                   # Проброс supabase клиента в page.data
    ├── layout.css                   # CSS-токены, типографика, компоненты
    │
    ├── +page.svelte                 # Главная: планировщик меню на неделю
    ├── +page.server.ts              # Загрузка menu_plans текущей персоны
    ├── +page.ts                     # Проброс данных
    │
    ├── auth/
    │   ├── +page.svelte             # Страница входа/регистрации
    │   └── callback/+server.ts      # OAuth callback (Supabase magic link)
    │
    ├── cart/
    │   ├── +page.svelte             # Корзина: ингредиенты + цены + холодильник
    │   └── +page.server.ts          # Загрузка cart_state из БД
    │
    ├── dishes/
    │   └── +page.svelte             # CRUD кастомных блюд + FatSecret поиск
    │
    ├── fridge/
    │   └── +page.svelte             # Холодильник: CRUD продуктов с qty/unit/expires
    │
    ├── onboarding/
    │   └── +page.svelte             # Создание персоны при первом входе
    │
    ├── settings/
    │   └── +page.svelte             # Настройки персоны (КБЖУ, активность, пропорции)
    │
    └── api/
        └── fatsecret/+server.ts     # Серверный прокси для FatSecret API (OAuth 2.0)
```

---

## База данных (Supabase)

### Таблицы

| Таблица | Что хранит |
|---------|-----------|
| `profiles` | Базовые профили пользователей (1:1 с auth.users) |
| `households` | Домохозяйства: ID + код приглашения |
| `household_members` | Связь пользователь ↔ домохозяйство |
| `personas` | Члены семьи с биопараметрами и нормами КБЖУ |
| `menu_plans` | Планы питания: персона + неделя + блюда по слотам |
| `cart_state` | Состояние корзины: отметки куплено + цены |
| `food_catalog` | Каталог из ~83 блюд с КБЖУ и ингредиентами |
| `custom_dishes` | Пользовательские блюда (JSONB) |
| `household_fridge` | Содержимое холодильника с qty, unit, expires_at |
| `household_join_requests` | Заявки на вступление в семью |

### Ключевые особенности схемы

**Домохозяйство vs пользователь:**  
Пользователь и персона — разные сущности. Персона = "кто ест" (может быть без аккаунта, например ребёнок). Пользователь = аккаунт (email/пароль).

**household_members — два поля household:**
- `household_id` — в каком домохозяйстве пользователь **сейчас активен**
- `own_household_id` — его **личное** домохозяйство (не меняется)
- Если равны → пользователь владелец; если разные → гость

**menu_plans — структура данных:**  
Каждая строка хранит весь план недели одной персоны. Слоты: `{day_index, meal_key, dish_name, grams, kcal, ...}`.

**food_catalog — единый источник блюд:**  
Все блюда лежат в Supabase. Поля ингредиентов: `{name, category, qty, unit}` — количество на одну порцию.

### RLS (Row Level Security)

Каждая таблица защищена политиками. Базовый принцип:
```sql
household_id IN (
  SELECT household_id FROM household_members WHERE user_id = auth.uid()
)
```
Пользователь видит только данные своего домохозяйства.

### Индексы производительности

```sql
idx_menu_plans_persona_week  — ON menu_plans(persona_id, week_label)
idx_cart_state_household_week — ON cart_state(household_id, week_label)
idx_food_catalog_category     — ON food_catalog(category)
idx_household_fridge_household — ON household_fridge(household_id)
```

---

## Основной тип данных — Dish

Единый тип для всех блюд (каталог + кастомные):

```typescript
interface DishIngredient {
  name:     string;
  category: ShoppingCategory;  // meat | dairy | grain | vegetable | fruit | condiment | other
  qty?:     number;            // количество на 1 порцию
  unit?:    string;            // 'г' | 'мл' | 'шт' | 'щепотка'
}

interface Dish {
  id:                number;
  name:              string;
  category:          DishCategory;  // breakfast | main | side | salad | snack
  kcal_per_100g:     number;
  protein_per_100g:  number;
  fat_per_100g:      number;
  carbs_per_100g:    number;
  portion_default_g: number;
  portion_min_g:     number;   // 50 (инжектируется в layout, не хранится в БД)
  portion_max_g:     number;   // 1000 (инжектируется в layout, не хранится в БД)
  cost_per_100g:     number;
  photo?:            string | null;
  ingredients:       DishIngredient[];
  _custom?:          boolean;
}
```

---

## Алгоритм генерации меню

Файл: [`src/lib/utils/generate.ts`](../src/lib/utils/generate.ts)

**Шаги:**

1. **Разбивка бюджета калорий:**
   - Перекус = 10% от цели
   - Основные приёмы = 90% от цели, делятся по `meal_ratios` (обычно bf:25%, ln:40%, dn:35%)

2. **Выбор блюда для слота:**
   - Из пула каталог + кастомные, фильтрация по категории
   - Сортировка по близости kcal_per_100g к целевому
   - **Случайный выбор из топ-3** → разнообразие при каждой регенерации

3. **Масштабирование порции:**
   - `grams = target_kcal / kcal_per_100g * 100`
   - Зажимается в `[portion_min_g, portion_max_g]`

4. **Carry-over ужин→обед:**
   - Если флаг `carry_dinner_to_lunch` = true, обед = ужин предыдущего дня

5. **Автоскейл при перегрузе:**
   - Если день превышает цель на >4% → все порции масштабируются вниз

---

## Логика глобальных данных (layout.server.ts)

При каждом запросе загружается:

```
auth session + user
    ↓ если авторизован
household_members → householdId
    ↓ параллельно
households + personas + custom_dishes + household_fridge
    ↓ с кешем TTL 5 мин
food_catalog (один запрос на весь сервер, не на каждого юзера)
```

**Кеш food_catalog:**  
`food_catalog` не меняется в рантайме — кешируется в памяти Node.js процесса на 5 минут. При 100 юзерах: 500 запросов/мин → 1 запрос каждые 5 мин.

---

## Корзина — логика формирования

Файл: [`src/lib/utils/ingredients.ts`](../src/lib/utils/ingredients.ts)

1. Берём все блюда из `menu_plans` текущей недели
2. Для каждого блюда находим ингредиенты в `food_catalog` или `custom_dishes`
3. Суммируем `qty` одинаковых ингредиентов по всем блюдам
4. Группируем по `ShoppingCategory`
5. Для каждого ингредиента ищем в `household_fridge` (case-insensitive по названию)
6. Показываем: `totalQty` — `fridgeQty` = **нужно купить**

**Отображение в корзине:**
```
Яйца   21 шт   🧊 −6 шт   = 15 шт
Молоко 400 мл  🧊 −400 мл  ✓ есть
```

---

## Страницы приложения

### `/` — Планировщик меню
- Вид недели (WeekGrid) или дня (DayView)
- Переключение между персонами
- Навигация по неделям (←→)
- Кнопка «Сгенерировать меню»
- Предупреждение если день >4% выше нормы
- Клик по блюду → DishDetailModal (ингредиенты, КБЖУ, замена)

### `/dishes` — Мои блюда
- Список кастомных блюд домохозяйства
- Создание/редактирование: название, КБЖУ/100г, порция, ингредиенты с qty/unit
- Поиск через FatSecret API (только на английском) — подтягивает КБЖУ
- Автодетект категории ингредиента по словарю

### `/cart` — Корзина
- Агрегированный список ингредиентов из меню текущей недели
- Суммарное количество (qty) и вычитание холодильника
- Чекбоксы "куплено" + цены (синхронизируются с Supabase)
- Итого / осталось докупить
- Экспорт в буфер обмена

### `/fridge` — Холодильник
- Список продуктов с qty, unit, сроком годности
- Предупреждение: просрочено (красный) / скоро истекает ≤3 дней (жёлтый)
- CRUD через модалку

### `/settings` — Настройки
- Редактирование параметров персоны
- Биометрика: пол, возраст, вес, рост, активность
- Расчёт КБЖУ по формуле Миффлина или Харриса
- Ручной режим: ввод своих норм КБЖУ

### `/onboarding` — Онбординг
- Создание персоны при первом входе
- Доступен только если нет персоны (guard в layout.server.ts)

### `/auth` — Авторизация
- Email + пароль (Supabase Auth)
- Редирект на `/onboarding` после первой регистрации

---

## FatSecret API

Файл: [`src/routes/api/fatsecret/+server.ts`](../src/routes/api/fatsecret/+server.ts)

- Серверный прокси (credentials не уходят на клиент)
- OAuth 2.0 `client_credentials` flow
- Метод: `foods.search` (бесплатный tier)
- Ограничение: поиск только на английском языке
- Парсинг КБЖУ из строки `food_description` через regex
- Токен кешируется до истечения (expires_in)

---

## Бренд-система

CSS-токены (в `layout.css`):

```css
--color-green-primary: #2E7D32
--color-green-dark:    #1B5E20
--color-bg-page:       #F5F5F5
--color-bg-card:       #FFFFFF
--color-border:        #E0E0E0
--color-text-primary:  #1A1A1A
--color-text-muted:    #757575
--color-warning:       #F59E0B
```

Полные правила — [BRAND.md](../BRAND.md)

---

## Миграции БД

Все SQL-файлы в `docs/`:

| Файл | Что делает |
|------|-----------|
| `schema-v5.sql` | Полная схема БД (создание с нуля) |
| `migration-food-catalog.sql` | Создание таблицы food_catalog |
| `migration-food-catalog-rename.sql` | Переименование колонок kcal→kcal_per_100g и т.д. |
| `migration-cart-state.sql` | Создание таблицы cart_state |
| `migration-indexes.sql` | Индексы производительности |
| `migration-add-ingredient-qty.sql` | Добавление qty/unit в ингредиенты food_catalog |
| `migration-fridge.sql` | Создание таблицы household_fridge + RLS |
| `migration-rls-custom-dishes-update.sql` | RLS политики UPDATE/DELETE для custom_dishes |
| `seed-food-catalog.sql` | 50 блюд с КБЖУ и ингредиентами |
| `seed-food-catalog-from-seed-dishes.sql` | +33 блюда из старой базы |

---

## Беклог и User Stories

Полный беклог: [`docs/backlog.md`](backlog.md)  
User Stories: `docs/us-*.md`

**Текущий прогресс по эпикам:**

| Эпик | Статус |
|------|--------|
| Инфраструктура | ✔️ полностью готово |
| Меню (генерация, отображение) | ✔️ полностью готово |
| Блюда (каталог, кастомные, FatSecret) | ✔️ готово |
| Корзина (агрегация, цены, чекбоксы, холодильник) | ✔️ готово |
| Холодильник (CRUD, вычитание) | ✔️ готово |
| Семья и персоны (базовая логика) | ✔️ частично |
| Настройки | ✔️ готово |

**Следующие задачи:**
- V5-053: Добавление в холодильник из корзины после покупки
- V5-063: Блок семьи — пригласить участников по коду
- V5-007: Настройка CI/CD на Netlify из GitHub

---

## Локальная разработка

```bash
# Установка зависимостей
pnpm install

# Запуск dev-сервера
pnpm dev

# Проверка типов
pnpm check

# Сборка
pnpm build
```

**Переменные окружения** (`.env`):
```
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
FATSECRET_CLIENT_ID=...
FATSECRET_CLIENT_SECRET=...
```
