# Установка YAS-DT v2.0

## Предварительные требования

- Node.js 18+ и npm
- Аккаунт Supabase (бесплатный tier подойдёт)
- Git (опционально)

## Шаг 1: Клонирование/Скачивание проекта

```bash
# Если используете Git
git clone <repository-url>
cd YAS-DT

# Или просто распакуйте архив
```

## Шаг 2: Установка зависимостей

```bash
npm install
```

Это установит:
- Next.js 14
- React 18
- Supabase JS Client
- TypeScript
- И другие зависимости

## Шаг 3: Настройка Supabase

### 3.1 Создание проекта

1. Перейдите на https://supabase.com
2. Войдите или зарегистрируйтесь
3. Нажмите "New Project"
4. Заполните:
   - **Name**: yas-dt (или любое другое)
   - **Database Password**: придумайте надёжный пароль
   - **Region**: выберите ближайший регион
5. Нажмите "Create new project"
6. Дождитесь создания (1-2 минуты)

### 3.2 Получение credentials

После создания проекта:

1. Перейдите в **Settings** → **API**
2. Скопируйте:
   - **Project URL** (например: `https://xxxxx.supabase.co`)
   - **service_role key** (в разделе "Project API keys")

⚠️ **ВАЖНО**: `service_role` key даёт полный доступ к БД. Не коммитьте его в Git!

### 3.3 Создание .env.local

```bash
cp .env.local.example .env.local
```

Откройте `.env.local` и вставьте ваши credentials:

```env
SUPABASE_URL=https://ваш-проект-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ваш-service-role-key
```

## Шаг 4: Применение SQL-схемы

### Вариант A: Через Dashboard (рекомендуется)

1. Откройте Supabase Dashboard
2. Перейдите в **SQL Editor**
3. Нажмите "New query"
4. Скопируйте содержимое файла `scripts/schema.sql`
5. Вставьте в редактор
6. Нажмите "Run" или Cmd/Ctrl + Enter

### Вариант B: Через CLI (если установлен Supabase CLI)

```bash
supabase db push
```

### Проверка

После выполнения SQL должны появиться таблицы:
- `facts`
- `fact_relations`
- `categories`
- `sections`

Проверьте в **Table Editor** в Dashboard.

## Шаг 5: Миграция данных

Запустите скрипт миграции v2.0:

```bash
npm run db:migrate:v2
```

Вы увидите:
```
🚀 Запуск миграции YAS v2.0 (Семантический граф знаний)...
📦 Загружено фактов: 163
✅ Очищено фактов: 163
📊 Категорий: 7
📂 Секций: 8
🔗 Построено связей: XX
...
🎉 МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!
```

### Проверка данных

Откройте Supabase Dashboard → Table Editor:
- `facts` - должно быть ~163 записи
- `fact_relations` - связи между фактами
- `categories` - 7 категорий
- `sections` - 8 секций

## Шаг 6: Запуск приложения

### Development режим

```bash
npm run dev
```

Откройте http://localhost:3000

Вы увидите:
- Главную страницу с описанием
- Ссылку на граф знаний
- Ссылку на API

### Production build

```bash
npm run build
npm start
```

## Проверка работоспособности

### 1. API endpoints

```bash
# Получить все факты
curl http://localhost:3000/api/facts

# Получить факт по ID
curl http://localhost:3000/api/facts?id=1

# Получить граф
curl http://localhost:3000/api/graph
```

### 2. Веб-интерфейс

- http://localhost:3000 - Главная страница
- http://localhost:3000/graph - Визуализация графа
- http://localhost:3000/api/facts - API фактов

## Troubleshooting

### Ошибка: "SUPABASE_URL is not defined"

**Решение**: Проверьте, что `.env.local` создан и содержит правильные значения.

```bash
# Проверить наличие файла
ls -la .env.local

# Проверить содержимое
cat .env.local
```

### Ошибка: "relation 'facts' does not exist"

**Решение**: SQL-схема не применена. Выполните Шаг 4.

### Ошибка: "duplicate key value violates unique constraint"

**Решение**: Очистите таблицы перед повторной миграцией:

```sql
-- Выполните в SQL Editor
TRUNCATE fact_relations, facts, categories, sections CASCADE;
```

Затем запустите миграцию снова:

```bash
npm run db:migrate:v2
```

### Ошибка: "Failed to load graph"

**Причины**:
1. Миграция не выполнена
2. .env.local не настроен
3. Supabase проект не создан

**Решение**: Проверьте все шаги по порядку.

### Порт 3000 занят

```bash
# Использовать другой порт
PORT=3001 npm run dev
```

## Следующие шаги

После успешной установки:

1. **Изучите данные**
   - Откройте Supabase Table Editor
   - Посмотрите структуру фактов и связей

2. **Попробуйте API**
   - Используйте curl или Postman
   - Изучите формат ответов

3. **Визуализация**
   - Откройте /graph
   - Изучите узлы и связи

4. **Кастомизация**
   - Добавьте свои факты
   - Создайте новые связи
   - Настройте визуализацию

## Дополнительные ресурсы

- [README.md](./README.md) - Обзор проекта
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Детальная архитектура
- [QUICKSTART.md](./QUICKSTART.md) - Быстрый старт
- [conception.md](./conception.md) - Концепция проекта
- [CHANGELOG.md](./CHANGELOG.md) - История изменений

## Поддержка

Если возникли проблемы:
1. Проверьте все шаги установки
2. Изучите раздел Troubleshooting
3. Проверьте логи в консоли браузера и терминале
4. Создайте issue в репозитории

---

**Версия**: 2.0.0  
**Последнее обновление**: 2024-05-25
