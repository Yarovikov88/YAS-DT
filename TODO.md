# TODO: Чеклист для запуска YAS-DT v2.0

## ✅ Что уже сделано

- [x] Создана нормализованная SQL-схема (`scripts/schema.sql`)
- [x] Написан скрипт миграции v2.0 (`scripts/migrate-v2.ts`)
- [x] Обновлены TypeScript типы (`types/index.ts`)
- [x] Создано Next.js приложение (папка `app/`)
- [x] Реализованы API endpoints (`/api/facts`, `/api/graph`)
- [x] Создана страница визуализации графа (`/graph`)
- [x] Написана полная документация (8 файлов .md)
- [x] Настроены конфигурации (tsconfig, next.config, .gitignore)

## 🔲 Что нужно сделать вам

### 1. Установка зависимостей

```bash
cd /Users/yarovikov88/YAS-DT
npm install
```

**Ожидаемый результат**: Установятся Next.js, React, Supabase и другие зависимости.

### 2. Настройка Supabase

#### 2.1 Создание проекта

1. Откройте https://supabase.com
2. Войдите или зарегистрируйтесь
3. Нажмите "New Project"
4. Заполните форму:
   - Name: `yas-dt`
   - Database Password: придумайте надёжный пароль
   - Region: выберите ближайший
5. Нажмите "Create new project"
6. Дождитесь создания (1-2 минуты)

#### 2.2 Получение credentials

1. Перейдите в **Settings** → **API**
2. Скопируйте:
   - **Project URL** (например: `https://xxxxx.supabase.co`)
   - **service_role key** (в разделе "Project API keys")

#### 2.3 Создание .env.local

```bash
cp .env.local.example .env.local
```

Откройте `.env.local` в редакторе и вставьте ваши credentials:

```env
SUPABASE_URL=https://ваш-проект-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ваш-service-role-key
```

**⚠️ ВАЖНО**: Не коммитьте `.env.local` в Git!

### 3. Применение SQL-схемы

1. Откройте Supabase Dashboard
2. Перейдите в **SQL Editor**
3. Нажмите "New query"
4. Откройте файл `scripts/schema.sql` в редакторе
5. Скопируйте всё содержимое
6. Вставьте в SQL Editor
7. Нажмите "Run" или Cmd/Ctrl + Enter

**Ожидаемый результат**: Создадутся таблицы `facts`, `fact_relations`, `categories`, `sections`.

**Проверка**: Перейдите в **Table Editor** и убедитесь, что таблицы созданы.

### 4. Миграция данных

```bash
npm run db:migrate:v2
```

**Ожидаемый результат**:
```
🚀 Запуск миграции YAS v2.0...
📦 Загружено фактов: 163
✅ Очищено фактов: 163
📊 Категорий: 7
📂 Секций: 8
🔗 Построено связей: XX
...
🎉 МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!
```

**Проверка**: Откройте Supabase Dashboard → Table Editor:
- `facts` - должно быть ~163 записи
- `fact_relations` - связи между фактами
- `categories` - 7 категорий
- `sections` - 8 секций

### 5. Запуск приложения

```bash
npm run dev
```

**Ожидаемый результат**:
```
▲ Next.js 14.2.3
- Local:        http://localhost:3000
- Ready in XXXms
```

Откройте http://localhost:3000 в браузере.

**Проверка**:
- Главная страница загружается
- Ссылка "📊 Граф знаний" работает
- API endpoints отвечают

### 6. Тестирование API

```bash
# Получить все факты
curl http://localhost:3000/api/facts | jq

# Получить факт по ID
curl http://localhost:3000/api/facts?id=1 | jq

# Получить граф
curl http://localhost:3000/api/graph | jq
```

**Ожидаемый результат**: JSON с данными.

## 🚀 Дальнейшее развитие

### Phase 2: Визуализация (следующий этап)

- [ ] Реализовать Canvas-based визуализацию
- [ ] Добавить force-directed layout
- [ ] Сделать узлы интерактивными
- [ ] Добавить фильтры по категориям/секциям
- [ ] Реализовать поиск по графу

### Phase 3: AI Integration

- [ ] Интегрировать Gemini API
- [ ] Автоматическое извлечение связей из текста
- [ ] Рекомендации новых связей
- [ ] Поиск противоречий в знаниях

### Phase 4: Аналитика

- [ ] Метрики графа (связность, плотность, центральность)
- [ ] Временная эволюция знаний
- [ ] Кластеризация по темам
- [ ] Экспорт в Neo4j

## 📚 Документация

Если что-то непонятно, читайте:

- **INSTALL.md** - Подробная инструкция по установке
- **QUICKSTART.md** - Быстрый старт
- **ARCHITECTURE.md** - Детальная архитектура
- **README.md** - Обзор проекта
- **conception.md** - Философия и концепция

## 🐛 Troubleshooting

### Ошибка: "SUPABASE_URL is not defined"

**Решение**: Проверьте, что `.env.local` создан и содержит правильные значения.

### Ошибка: "relation 'facts' does not exist"

**Решение**: SQL-схема не применена. Выполните Шаг 3.

### Ошибка: "Failed to load graph"

**Решение**: 
1. Проверьте, что миграция выполнена (Шаг 4)
2. Проверьте .env.local
3. Проверьте логи в терминале

### Порт 3000 занят

```bash
PORT=3001 npm run dev
```

## ✅ Финальный чеклист

- [ ] npm install выполнен
- [ ] Supabase проект создан
- [ ] .env.local настроен
- [ ] SQL-схема применена
- [ ] Миграция выполнена успешно
- [ ] npm run dev запущен
- [ ] http://localhost:3000 открывается
- [ ] API endpoints работают
- [ ] Граф знаний отображается

---

**Удачи с запуском! 🚀**

Если возникнут вопросы - все ответы в документации.
