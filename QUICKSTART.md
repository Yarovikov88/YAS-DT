# 🚀 Быстрый старт YAS-DT v2.0

## Что было сделано

Копилот начал миграцию с Python на TypeScript/Next.js, но оставил **архитектурные проблемы**:

❌ **v1.0 (Плоский монолит)**
- Связи как плоский массив `relations: number[]`
- Всё в одной таблице `facts`
- Нет семантики связей

✅ **v2.0 (Семантический граф)** - ГОТОВО!
- Нормализованная схема БД
- Типизированные связи (10 типов)
- Таблица `fact_relations` для рёбер графа
- Метаданные: категории, секции, веса

## Шаги для запуска

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка Supabase

#### Вариант A: Создать новый проект

1. Перейдите на https://supabase.com
2. Создайте новый проект
3. Скопируйте URL и Service Role Key

#### Вариант B: Использовать существующий

Если у вас уже есть проект Supabase, используйте его credentials.

### 3. Создание .env.local

```bash
cp .env.local.example .env.local
```

Отредактируйте `.env.local`:

```env
SUPABASE_URL=https://ваш-проект.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ваш-service-role-key
```

### 4. Применение SQL-схемы

Откройте Supabase Dashboard → SQL Editor и выполните содержимое файла:

```bash
cat scripts/schema.sql
```

Или скопируйте и вставьте SQL в редактор.

**Что создаётся:**
- Таблица `facts` (узлы графа)
- Таблица `fact_relations` (рёбра графа)
- Таблица `categories` (категории)
- Таблица `sections` (секции)
- Индексы для быстрых запросов
- Представление `facts_with_stats`

### 5. Запуск миграции

```bash
npm run db:migrate:v2
```

**Что происходит:**
1. ✅ Читает `data/yas_core_v2.6.json`
2. ✅ Удаляет дубликаты по названию
3. ✅ Разрешает коллизии ID
4. ✅ Извлекает категории и секции
5. ✅ Преобразует плоские связи в типизированные
6. ✅ Загружает всё в Supabase

### 6. Проверка результата

Откройте Supabase Dashboard → Table Editor:

- `facts` - должно быть ~163 записи
- `fact_relations` - связи между фактами
- `categories` - ~7 категорий
- `sections` - ~8 секций

## Что дальше?

### Вариант 1: Визуализация графа

Создать Next.js приложение с интерактивным графом:

```bash
# Создать структуру приложения
mkdir -p app/graph app/api/graph
```

### Вариант 2: API для работы с графом

Создать REST API для запросов к графу:

```typescript
// app/api/graph/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const factId = searchParams.get('id');
  
  // Получить факт со всеми связями
  const { data } = await supabase
    .from('facts')
    .select(`
      *,
      outgoing:fact_relations!source_fact_id(*),
      incoming:fact_relations!target_fact_id(*)
    `)
    .eq('id', factId);
  
  return Response.json(data);
}
```

### Вариант 3: AI-интеграция

Добавить Gemini API для автоматического извлечения связей:

```bash
# Добавить в .env.local
GEMINI_API_KEY=your-key
```

## Структура файлов

```
YAS-DT/
├── 📄 README.md              # Обзор проекта
├── 📄 ARCHITECTURE.md        # Детальная архитектура
├── 📄 QUICKSTART.md          # Этот файл
├── 📁 scripts/
│   ├── migrate-v2.ts         # ⭐ Новая миграция
│   └── schema.sql            # ⭐ SQL-схема
├── 📁 types/
│   └── index.ts              # ⭐ Обновлённые типы
└── 📁 data/
    └── yas_core_v2.6.json    # Исходные данные
```

## Типы связей

| Тип | Описание | Пример |
|-----|----------|--------|
| `causes` | Причина → Следствие | "Наследие строителей" → "Неприятие костылей" |
| `influences` | Влияние | "Шмидт" → "Стиль управления" |
| `prerequisite_for` | Предусловие | "Военная академия" → "Разведка" |
| `applies_to` | Применяется к | "Метод Шмидта" → "FlyNav" |
| `similar_to` | Похоже на | "Казарма" ≈ "Корпоративный хаос" |
| `related_to` | Общая связь | Любая другая связь |

## Примеры запросов

### Найти все факты, влияющие на FlyNav

```sql
SELECT f.title, fr.relation_type
FROM facts f
JOIN fact_relations fr ON f.id = fr.source_fact_id
WHERE fr.target_fact_id = 9  -- FlyNav
  AND fr.relation_type IN ('influences', 'applies_to');
```

### Найти самые связанные факты (хабы)

```sql
SELECT title, total_relations_count
FROM facts_with_stats
ORDER BY total_relations_count DESC
LIMIT 10;
```

## Troubleshooting

### Ошибка: "SUPABASE_URL is not defined"

Проверьте, что `.env.local` создан и содержит правильные значения.

### Ошибка: "relation 'facts' does not exist"

Вы забыли применить SQL-схему. Выполните `scripts/schema.sql` в Supabase Dashboard.

### Ошибка: "duplicate key value violates unique constraint"

Очистите таблицы перед повторной миграцией:

```sql
TRUNCATE fact_relations, facts, categories, sections CASCADE;
```

## Поддержка

Вопросы и предложения: создайте issue в репозитории или свяжитесь с архитектором.

---

**Архитектор**: Андрей Яровиков (YAS)  
**Версия**: 2.0.0  
**Статус**: ✅ Готово к запуску
