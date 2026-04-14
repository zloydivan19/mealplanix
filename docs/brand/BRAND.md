# PlanMeal — BRAND.md
> Машиночитаемый брендбук для Claude Code. Версия 1.0, апрель 2026.
> Используй этот файл при создании ЛЮБОГО UI-компонента, страницы или стиля.
> Все правила обязательны. При конфликте двух правил — спроси перед реализацией.

---

## 1. Суть бренда

**Продукт:** Веб-сервис для планирования питания на неделю.
**Аудитория:** Русскоязычные семьи (СНГ), 1–5 человек.
**Конкурент:** eatthismuch.com
**Платформы:**
- Лендинг-сайт — только светлая тема, десктоп-first
- Веб-приложение (планировщик) — светлая + тёмная тема, адаптив под мобильный

**Формула позиционирования:**
> PlanMeal — удобный сервис для планирования питания на неделю, который помогает семье меньше тратить времени на хаос с едой и покупками.

**Ключевые ассоциации:** простота, спокойный контроль, семейность, организация.
**Характер бренда:** Спокойный, полезный, современный. Дружелюбный, но не инфантильный.

---

## 2. Цвета

### Основная палитра

| Токен | HEX | Применение |
|---|---|---|
| `green-primary` | `#2E7D32` | Основные кнопки, активные табы, ключевые акценты |
| `green-soft` | `#66BB6A` | Hover, вторичные акценты, теги, бейджи |
| `green-dark` | `#1B5E20` | Hover для primary-кнопок |
| `orange-accent` | `#FF8F00` | CTA (один раз на экран), важные метрики |
| `orange-dark` | `#E65100` | Hover для CTA-кнопок |
| `bg-light` | `#F7FAF7` | Фон сайта, секции, подложки карточек |
| `bg-white` | `#FFFFFF` | Карточки, модалки, поля ввода |
| `text-primary` | `#1F2937` | Заголовки, параграфы, навигация |
| `text-muted` | `#6B7280` | Подписи, плейсхолдеры, вторичный текст |
| `border` | `#E5E7EB` | Разделители, обводки инпутов, таблицы |
| `error` | `#EF4444` | Ошибки, деструктивные действия |
| `success` | `#22C55E` | Успешные действия, подтверждения |
| `warning` | `#F59E0B` | Предупреждения |

### CSS-переменные (`src/app.css`)

```css
:root {
  /* Бренд */
  --color-green-primary: #2E7D32;
  --color-green-soft:    #66BB6A;
  --color-green-dark:    #1B5E20;
  --color-orange-accent: #FF8F00;
  --color-orange-dark:   #E65100;

  /* Фоны */
  --color-bg-page:  #F7FAF7;
  --color-bg-card:  #FFFFFF;
  --color-bg-input: #FFFFFF;

  /* Текст */
  --color-text-primary: #1F2937;
  --color-text-muted:   #6B7280;
  --color-text-inverse: #FFFFFF;

  /* Семантика */
  --color-border:  #E5E7EB;
  --color-error:   #EF4444;
  --color-success: #22C55E;
  --color-warning: #F59E0B;

  /* Тени */
  --shadow-sm:    0 1px 2px rgba(0,0,0,0.05);
  --shadow-card:  0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06);
  --shadow-hover: 0 4px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.08);
  --shadow-modal: 0 8px 32px rgba(0,0,0,0.14);

  /* Скругления */
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   14px;
  --radius-xl:   20px;
  --radius-pill: 9999px;

  /* Отступы */
  --space-1: 4px;   --space-2: 8px;
  --space-3: 12px;  --space-4: 16px;
  --space-5: 24px;  --space-6: 32px;
  --space-8: 48px;  --space-10: 64px;
  --space-12: 80px; --space-16: 96px;

  /* Анимации */
  --transition-fast:   150ms ease;
  --transition-normal: 220ms ease;
  --transition-slow:   350ms ease;

  /* Z-индексы */
  --z-dropdown: 100;
  --z-sticky:   200;
  --z-overlay:  300;
  --z-modal:    400;
  --z-toast:    500;
}
```

### Tailwind конфиг (`tailwind.config.ts`)

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'green-primary': '#2E7D32',
        'green-soft':    '#66BB6A',
        'green-dark':    '#1B5E20',
        'orange-accent': '#FF8F00',
        'orange-dark':   '#E65100',
        'bg-light':      '#F7FAF7',
        'text-primary':  '#1F2937',
        'text-muted':    '#6B7280',
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '14px',
        'xl': '20px',
      },
      boxShadow: {
        'card':  '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06)',
        'hover': '0 4px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.08)',
        'modal': '0 8px 32px rgba(0,0,0,0.14)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
} satisfies Config;
```

### Правила применения цветов

- `green-primary` — только для PRIMARY-кнопок и активных состояний
- `orange-accent` — только для ОДНОГО главного CTA на экране, не для декора
- Не ставить `orange-accent` и `green-primary` рядом в одном блоке — конкурируют
- `green-soft` — для тегов, бейджей, вторичных иконок, hover
- Текст на зелёном фоне — всегда белый (`#FFFFFF`)
- Текст на оранжевом фоне — всегда белый (`#FFFFFF`)

---

## 3. Типографика

**Шрифт:** Inter
**Google Fonts:** `https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap`

| Стиль | Размер | Weight | Line-height | Применение |
|---|---|---|---|---|
| H1 | clamp(36px, 5vw, 48px) | 700 | 1.15 | Hero, ключевые заголовки |
| H2 | clamp(24px, 3.5vw, 32px) | 600 | 1.25 | Заголовки секций |
| H3 | clamp(18px, 2.5vw, 24px) | 600 | 1.35 | Карточки, модалки |
| Body | 16–18px | 400 | 1.65 | Основной текст |
| Small | 14px | 400 | 1.5 | Подписи, пояснения |
| Label | 13px | 600 | 1.4 | Лейблы форм, метки таблиц |
| Button | 15px | 600 | 1 | Текст кнопок |

```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 16px;
  line-height: 1.65;
  color: var(--color-text-primary);
  background: var(--color-bg-page);
  -webkit-font-smoothing: antialiased;
}

h1 { font-size: clamp(36px, 5vw, 48px);   font-weight: 700; line-height: 1.15; }
h2 { font-size: clamp(24px, 3.5vw, 32px); font-weight: 600; line-height: 1.25; }
h3 { font-size: clamp(18px, 2.5vw, 24px); font-weight: 600; line-height: 1.35; }
```

---

## 4. Логотип

**Компоненты иконки:** календарь + галочка + клош (символ блюда)
**Текст:** `plan` цвет `#2E7D32` + `meal` цвет `#FF8F00`, weight Bold/Black

**Версии:**
- Основная — иконка + wordmark, прозрачный фон
- Favicon / App icon — только иконка
- Монохромная — для тёмных носителей, цвет `#1F2937`

**Правила:**
- Логотип ВСЕГДА без фона (SVG, прозрачный)
- Минимальный размер: 120px по ширине
- Охранная зона: ≥ 16px со всех сторон
- Не добавлять тени, обводки, градиенты к логотипу
- Не менять пропорции, цвета, шрифт логотипа

**Файлы:** `static/logo.svg`, `static/favicon.ico`, `static/logo-mono.svg`

---

## 5. Адаптивность и сетка

### Брейкпоинты

| Имя | px | Описание |
|---|---|---|
| `sm` | 480px | Крупные телефоны |
| `md` | 768px | Планшеты |
| `lg` | 1024px | Ноутбуки |
| `xl` | 1280px | Десктоп |

Использовать стандартные Tailwind-брейкпоинты — не переопределять.

### Контейнер

```css
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px; /* md: 20px, sm: 16px */
}
```

### Навигация по платформам

**Лендинг:**
- Десктоп: горизонтальный header, логотип слева, кнопки справа
- Мобильный (< 768px): бургер-меню

**Веб-приложение:**
- Десктоп (> 1024px): боковая панель 240px фиксированная
- Планшет (768–1024px): боковая панель скрыта, открывается по кнопке
- Мобильный (< 768px): Bottom Tab Bar с 5 иконками

---

## 6. Компоненты

### Кнопки

```
PRIMARY   bg=#2E7D32  text=white  hover=#1B5E20  active=scale(0.98)  radius=10px  padding=12px 20px  font=15px/600
SECONDARY bg=white  text=#2E7D32  border=2px solid #2E7D32  hover-bg=#F7FAF7
CTA       bg=#FF8F00  text=white  hover=#E65100  (только один раз на страницу)
GHOST     bg=transparent  text=#1F2937  hover-bg=#F7FAF7
DANGER    bg=#EF4444  text=white  hover=#DC2626
DISABLED  opacity=0.45  cursor=not-allowed
```

- Все кнопки: `transition: background 150ms ease, transform 150ms ease`
- Кнопка-загрузка: спиннер вместо текста, pointer-events=none
- Иконка в кнопке: 16px, gap=8px

### Карточки

```
bg=white  radius=14px  shadow=var(--shadow-card)  padding=20–24px
hover: shadow=var(--shadow-hover)  transform=translateY(-2px)  transition=220ms
Кликабельная: cursor=pointer
С акцентом: border-left=3px solid #2E7D32
```

### Инпуты

```
bg=white  border=1.5px solid #E5E7EB  radius=8px  padding=10px 14px  font=15px/400
focus:  border=#2E7D32  box-shadow=0 0 0 3px rgba(46,125,50,0.12)
error:  border=#EF4444  box-shadow=0 0 0 3px rgba(239,68,68,0.12)
```

### Теги и бейджи

```
Зелёный:   bg=#E8F5E9  text=#2E7D32  radius=pill  padding=3px 10px  font=13px/600
Оранжевый: bg=#FFF3E0  text=#E65100  radius=pill  padding=3px 10px  font=13px/600
Серый:     bg=#F3F4F6  text=#6B7280  radius=pill  padding=3px 10px  font=13px/600
```

### Модальные окна

```
Overlay:  bg=rgba(0,0,0,0.45)  backdrop-filter=blur(2px)
Окно:     bg=white  radius=20px  shadow=var(--shadow-modal)  padding=28px
Ширины:   360px (компактный) / 480px (стандарт) / 600px (широкий)
Структура: заголовок H3 + крестик → контент → кнопки [Secondary] [Primary] справа
```

### Toast-уведомления

```
Success: bg=#F0FDF4  border=1px solid #86EFAC  text=#166534
Error:   bg=#FEF2F2  border=1px solid #FCA5A5  text=#991B1B
Warning: bg=#FFFBEB  border=1px solid #FCD34D  text=#92400E
Позиция: правый нижний угол, z-index=var(--z-toast)
Время:   3с (success/info), 6с (error), без авто-скрытия для критичных
```

### Skeleton-загрузка

- Использовать skeleton вместо спиннера, когда известна форма контента
- Цвет: фон `#F3F4F6`, shimmer `#E5E7EB`, анимация 1.5s infinite
- Спиннер — только для кнопок и inline-загрузки

### Empty State (пустые состояния)

```
Иконка:    48px, цвет #9CA3AF
Заголовок: H3, text-primary
Подпись:   16px, text-muted
CTA:       Primary кнопка
```

Пример: "Меню на эту неделю пока пусто" + "Добавить блюдо"

---

## 7. Компоненты приложения (app-specific)

### MealCard (карточка блюда в слоте)

```
min-height=120px  radius=12px  shadow=var(--shadow-sm)  bg=white
Название: 14px/600  text-primary
КБЖУ:     12px/400  text-muted  строкой "350 ккал · Б20 Ж12 У40"
Стоимость: 12px/600  green-primary
Пустой слот: border=2px dashed #E5E7EB  bg=#FAFAFA
Hover пустого: border-color=#66BB6A  bg=#F0FDF4
```

### WeekGrid (7 × 3)

```
CSS Grid: 7 колонок (десктоп), горизонтальный скролл (мобильный)
Заголовки дней: 13px/600  text-muted  text-center
Строки приёмов: лейбл "Завтрак/Обед/Ужин" слева 13px/600
Текущий день: колонка bg=#F0FDF4, заголовок green-primary
```

### KbjuBar (полоска БЖУ)

```
Контейнер: height=6px  bg=#E5E7EB  radius=pill
Белки:     #60A5FA
Жиры:      #F97316
Углеводы:  #FACC15
Превышение: #EF4444
```

### PersonaBadge

```
Аватар: 32px, круглый, инициалы на green-soft (если нет фото)
Имя:    14px/600  text-primary
Активная персона: border=2px solid green-primary
```

---

## 8. Тон коммуникации

**Язык:** Только русский. Обращение — **"ты"** (не "вы").

| ❌ Не так | ✅ Лучше так |
|---|---|
| Ошибка при загрузке меню. | Не получилось загрузить меню. Попробуем ещё раз? |
| Оптимизируйте weekly nutrition workflow. | Планируйте питание на неделю без хаоса. |
| Данные сохранены успешно. | Сохранили ✓ |
| Произошла непредвиденная ошибка. | Что-то пошло не так. Обнови страницу. |
| Пользователь не найден. | Такой почты у нас нет. Попробуй другую? |
| Заполните обязательные поля. | Нужно заполнить имя и почту. |

**Правила:**
- CTA: инфинитив — "Начать", "Составить", "Посмотреть"
- Запрещённые слова: трекинг, воркфлоу, онбординг, юзер, дэшборд, имейл
- `!` — только в CTA-блоках лендинга, не в системных сообщениях
- Числа КБЖУ: всегда с единицами — "350 ккал", "20 г белка"

---

## 9. Структура лендинга

| Блок | Что показываем |
|---|---|
| Navbar | Логотип + Возможности / Как работает / Тарифы / FAQ + Войти / Начать |
| Hero | H1 + подзаголовок + 2 CTA + скриншот **веб**-интерфейса |
| Возможности | 4 карточки: меню, покупки, холодильник, КБЖУ |
| Как работает | 3 шага: составь меню → список куплю → отметь дома |
| Превью | Широкий скриншот планировщика (веб, не телефон) |
| CTA | bg=#F7FAF7, повторный призыв + оранжевая кнопка |
| Footer | Логотип + навигация + политика + контакты |

**Тексты Hero:**
- H1: `Планируйте питание на неделю без хаоса`
- Subtitle: `Составляйте меню, управляйте списком покупок и следите за продуктами дома в одном сервисе.`
- CTA primary (оранжевый): `Начать планировать`
- CTA secondary: `Посмотреть возможности`

---

## 10. Скриншоты и иллюстрации

- Показывать только **веб-интерфейс** — не телефоны, не руки с телефоном
- Русские имена в демо: Катя, Михаил, Даша, Максим
- Русские блюда: Борщ, Гречка с котлетой, Овсянка, Куриный суп, Салат Цезарь
- Семейный контекст: несколько персон (мама + папа + ребёнок)
- Реалистичные КБЖУ: 1800–2400 ккал для взрослых, 1400–1600 для детей

---

## 11. Тёмная тема (только веб-приложение, не лендинг)

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-page:      #111827;
    --color-bg-card:      #1F2937;
    --color-bg-input:     #1F2937;
    --color-text-primary: #F9FAFB;
    --color-text-muted:   #9CA3AF;
    --color-border:       #374151;
    --shadow-card:  0 1px 3px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2);
    --shadow-hover: 0 4px 8px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.25);
    /* green-primary и orange-accent НЕ меняются */
  }
}
```

В SvelteKit переключать класс `dark` на `<html>` через store, не полагаться только на `prefers-color-scheme`.

---

## 12. Доступность

- Минимальный контраст текста: 4.5:1 (WCAG AA)
- Focus ring: `outline: 2px solid #2E7D32; outline-offset: 2px`
- Иконки без текста: обязателен `aria-label`
- Изображения: обязателен `alt`
- Кнопки-иконки: min-size 44×44px (mobile tap target)
- Не передавать смысл только через цвет — добавлять иконку или текст

---

## 13. Анимации

```css
/* Карточки */
.card { transition: box-shadow var(--transition-normal), transform var(--transition-normal); }

/* Модалки */
.modal-enter { animation: fadeInUp 220ms ease forwards; }
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Skeleton shimmer */
@keyframes shimmer {
  from { background-position: -400px 0; }
  to   { background-position:  400px 0; }
}

/* Уважаем prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Максимальная длительность UI-анимаций: 400ms.

---

## 14. Запрещено

- ❌ Фиолетовые, розовые, синие акценты — не в палитре
- ❌ `orange-accent` больше одного раза на экране
- ❌ `green-primary` и `orange-accent` в одном блоке рядом
- ❌ Тени на тексте (`text-shadow`)
- ❌ Font-weight 400 для кнопок и лейблов
- ❌ Border-radius < 6px для интерактивных элементов
- ❌ Замена Inter без согласования
- ❌ Мобильные mockup'ы (телефон в руке) на лендинге
- ❌ Тексты на английском в UI
- ❌ Lorem ipsum — только реальные русские данные
- ❌ Хардкод цветов в компонентах — только CSS-переменные или Tailwind-токены
- ❌ `!important` в стилях (исключение: prefers-reduced-motion)
- ❌ `any` в TypeScript
- ❌ Изменение схемы Supabase без явного указания
