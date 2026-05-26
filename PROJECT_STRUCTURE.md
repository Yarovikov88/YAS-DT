# Структура проекта YAS-DT v2.0

## Обзор файловой системы

```
YAS-DT/
├── 📁 app/                    # Next.js App Router
│   ├── 📁 api/               # API endpoints
│   │   ├── 📁 facts/         # API для работы с фактами
│   │   │   └── route.ts      # GET /api/facts
│   │   └── 📁 graph/         # API для графа
│   │       └── route.ts      # GET /api/graph
│   ├── 📁 graph/             # Страница визуализации
│   │   └── page.tsx          # /graph
│   ├── layout.tsx            # Корневой layout
│   ├── page.tsx              # Главная страница /
│   └── globals.css           # Глобальные стили
│
├── 📁 scripts/               # Скрипты миграции
│   ├── migrate.ts            # Legacy миграция v1.0
│   ├── migrate-v2.ts         # ⭐ Новая миграция v2.0
│   └── schema.sql            # ⭐ SQL-схема для Supabase
│
├── 📁 types/                 # TypeScript типы
│   └── index.ts              # ⭐ Типы для графа знаний
│
├── 📁 data/                  # Исходные данные
│   ├── yas_core.json         # Legacy данные v1.0
│   ├── yas_core_v2.6.json    # Актуальные данные
│   └── raw_source.txt        # Сырые данные (пусто)
│
├── 📁 legacy/                # Устаревший код
│   ├── brain.py              # Python CLI
│   └── editor.html           # HTML редактор
│
├── 📁 src/                   # Дополнительные исходники
│   └── editor 1.html         # Копия редактора
│
├── 📁 core/                  # Бизнес-логика (пусто)
├── 📁 tests/                 # Тесты (пусто)
│
├── 📄 package.json           # Зависимости и скрипты
├── 📄 tsconfig.json          # TypeScript конфигурация
├── 📄 next.config.js         # Next.js конфигурация
├── 📄 next-env.d.ts          # Next.js типы
│
├── 📄 .env.local.example     # Пример конфигурации
├── 📄 .gitignore             # Git ignore
│
├── 📄 README.md              # ⭐ Обзор проекта
├── 📄 ARCHITECTURE.md        # ⭐ Детальная архитектура
├── 📄 QUICKSTART.md          # ⭐ Быстрый старт
├── 📄 INSTALL.md             # ⭐ Инструкция по установке
├── 📄 conception.md          # ⭐ Концепция проекта
├── 📄 CHANGELOG.md           # ⭐ История изменений
└── 📄 PROJECT_STRUCTURE.md   # ⭐ Этот файл
```

## Команды npm

```bash
# Разработка
npm run dev              # Запуск dev-сервера (localhost:3000)
npm run build            # Production build
npm run start            # Запуск production сервера
npm run lint             # Проверка кода

# База данных
npm run db:migrate       # Legacy миграция v1.0
npm run db:migrate:v2    # ⭐ Новая миграция v2.0
npm run db:schema        # Подсказка по применению SQL-схемы
```

## Roadmap

### Phase 1: Фундамент ✅
- [x] Нормализованная схема БД
- [x] TypeScript типы
- [x] Скрипт миграции v2.0
- [x] Next.js приложение
- [x] API endpoints
- [x] Документация

### Phase 2: Визуализация 🚧
- [x] Базовая страница графа
- [ ] Canvas-based визуализация
- [ ] Force-directed layout

---

**Версия**: 2.0.0  
**Архитектор**: Андрей Яровиков (YAS)
