# YAS-DT — Digital Twin

Семантический граф знаний (цифровой двойник): личная база фактов, связанных типизированными
рёбрами, с интерактивной визуализацией. Next.js 14 + Supabase (PostgreSQL).

> Документация проекта держится в трёх файлах: **README.md** (что это и как запустить, вы здесь),
> **CHANGELOG.md** (история по версиям), **conception.md** (философия и модель данных).
> Активные задачи и дизайн фич ведутся в спеках — `.kiro/specs/`.

## Что это

- **Узлы** — факты (события, принципы, кейсы), хранятся в таблице `facts`.
- **Рёбра** — типизированные связи между фактами (`fact_relations`), 10 семантических типов.
- **Таксономия** — каждый факт привязан к одной из 8 **сфер HPI** + набору свободных **тегов**
  из контролируемых словарей (тип / контекст / этап).
- **Визуализация** — интерактивный SVG-граф с физикой в Web Worker, фильтрами и поиском.

### 8 сфер HPI

`loved` · `family` · `friends` · `career` · `physical` · `mental` · `hobby` · `wealth`

### Типы связей

`causes` · `influences` · `contradicts` · `supports` · `derives_from` · `applies_to`
· `similar_to` · `part_of` · `prerequisite_for` · `related_to`

## Стек

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript (strict)
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Визуализация**: SVG + force-directed раскладка в Web Worker
- **AI**: Gemini API (классификация фактов по сферам/тегам)

## Структура

```
YAS-DT/
├── app/
│   ├── api/
│   │   ├── facts/route.ts   # GET /api/facts — факты с фильтрами
│   │   └── graph/route.ts   # GET /api/graph — { nodes, edges, stats }
│   ├── graph/page.tsx       # /graph — визуализация графа
│   ├── layout.tsx
│   └── page.tsx             # главная
├── scripts/
│   ├── schema.sql           # базовая схема (facts, fact_relations, ...)
│   ├── add-spheres-tags.sql # патч: sphere + tags
│   ├── migrate-v2.ts        # миграция данных в Supabase
│   └── classify-facts.ts    # авто-классификация через Gemini API
├── types/index.ts           # TypeScript типы графа
├── data/                    # исходные данные (yas_core_v2.6.json)
└── .kiro/specs/             # спеки фич (requirements / design / tasks)
```

## Быстрый старт

### 1. Зависимости

```bash
npm install
```

### 2. Переменные окружения

Создайте `.env.local` в корне проекта:

```env
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
GEMINI_API_KEY=<gemini-api-key>   # нужен только для classify-facts
```

Credentials берутся в Supabase Dashboard → **Settings → API**.
`.env.local` в `.gitignore` — не коммитьте секреты.

### 3. Схема БД

Откройте Supabase Dashboard → **SQL Editor** и выполните по очереди:

1. `scripts/schema.sql` — таблицы `facts`, `fact_relations` и индексы
2. `scripts/add-spheres-tags.sql` — колонки `sphere` и `tags`

### 4. Миграция данных

```bash
npm run db:migrate:v2
```

### 5. Запуск

```bash
npm run dev
```

Откройте http://localhost:3000 — главная, и http://localhost:3000/graph — граф знаний.

## npm-скрипты

```bash
npm run dev            # dev-сервер (localhost:3000)
npm run build          # production build
npm run start          # production сервер
npm run lint           # ESLint
npm run db:migrate:v2  # миграция данных в Supabase
npm run db:classify    # классификация фактов по сферам/тегам через Gemini
```

## API

| Эндпоинт | Описание |
|----------|----------|
| `GET /api/facts` | Факты с фильтрами (`?category=`, `?section=`, `?id=`, `?limit=`) |
| `GET /api/graph` | Полный граф: `{ nodes, edges, stats }` |

## Возможности графа

- Force-directed раскладка, цвета узлов по сферам HPI, размер по весу
- Excel-подобные мультифильтры по сферам и тегам (выбор нескольких, «выбрать/снять все», счётчики)
- Диапазонные фильтры по возрасту и весу
- Поиск, pan/zoom, fit-to-screen
- Панель деталей: markdown-контент факта, кликабельные теги, навигация по связям

---

**Архитектор**: Андрей Яровиков (YAS) · текущая версия — см. `package.json` и `CHANGELOG.md`
