# Архитектура YAS-DT v2.0

## Философия проектирования

> "Любой проект — от семейного дома до ИТ-инфраструктуры — рассматривается как капитальное строение. Если фундамент слаб, система генерирует сигнал критической ошибки и стремится к рефакторингу."

### Принципы

1. **Greenfield подход** - полная перестройка, legacy-код заморожен
2. **Строительство слоями** - завершаем каждый слой перед переходом к следующему
3. **Наследие строителя** - никаких временных решений, только масштабируемая архитектура
4. **Семейная песочница** - изолированное пространство для обучения

## Проблемы v1.0 (Плоский монолит)

### 1. Плоские связи без семантики

```typescript
// ❌ Плохо: непонятно, что означает связь
interface YasFact {
  id: 1,
  title: "Генезис Ядра",
  relations: [7, 29] // Что это значит? Почему связаны?
}
```

**Проблемы:**
- Невозможно понять природу связи
- Нет веса/приоритета связей
- Сложно строить семантические запросы
- Граф не поддаётся анализу

### 2. Денормализованная структура

```typescript
// ❌ Плохо: всё в одной таблице
facts: {
  id, title, content, category, section, relations: number[]
}
```

**Проблемы:**
- Связи закидываются внутрь строк
- Невозможно эффективно индексировать
- Сложно делать графовые запросы
- Дублирование данных категорий/секций

## Решение v2.0 (Семантический граф)

### 1. Нормализованная схема

```
┌─────────────┐
│  categories │
└─────────────┘
       ↓
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│    facts    │◄────►│ fact_relations   │◄────►│    facts    │
│  (узлы)     │      │    (рёбра)       │      │  (узлы)     │
└─────────────┘      └──────────────────┘      └─────────────┘
       ↓
┌─────────────┐
│  sections   │
└─────────────┘
```

### 2. Типизированные связи

```typescript
// ✅ Хорошо: семантика связи явная
interface FactRelation {
  source_fact_id: 1,
  target_fact_id: 7,
  relation_type: 'prerequisite_for', // Явный тип!
  weight: 0.8,                        // Сила связи
  description: "Генезис → Урок точки росы"
}
```

**Преимущества:**
- Понятная семантика связей
- Возможность фильтрации по типу
- Взвешенные связи для приоритизации
- Описание для контекста

### 3. Типы связей

| Тип | Описание | Пример |
|-----|----------|--------|
| `causes` | Причинно-следственная | "Наследие строителей" → "Неприятие костылей" |
| `influences` | Влияние | "Шмидт" → "Стиль управления" |
| `contradicts` | Противоречие | "Быстрый релиз" ↔ "Идеальная архитектура" |
| `supports` | Поддержка | "Трезвость" → "Ассертивность" |
| `derives_from` | Происходит из | "ROBIUS" ← "Опыт отцовства" |
| `applies_to` | Применяется к | "Метод Шмидта" → "FlyNav" |
| `similar_to` | Похоже на | "Казарма" ≈ "Корпоративный хаос" |
| `part_of` | Часть чего-то | "Deep Work" ⊂ "Психофизика" |
| `prerequisite_for` | Предусловие | "Военная академия" → "Разведка" |
| `related_to` | Общая связь | Любая другая связь |

## Схема базы данных

### Таблица `facts` (узлы графа)

```sql
CREATE TABLE facts (
  id INTEGER PRIMARY KEY,           -- Уникальный ID факта
  title TEXT NOT NULL,              -- Название
  content TEXT NOT NULL,            -- Полное содержание
  category TEXT NOT NULL,           -- Категория (Военный, Технология, ...)
  section TEXT NOT NULL,            -- Секция (ГЕНЕЗИС, ВОЕННАЯ АКАДЕМИЯ, ...)
  weight DECIMAL(3,2) DEFAULT 0.70, -- Вес факта (важность)
  age INTEGER,                      -- Возраст при событии
  status TEXT DEFAULT 'active',     -- active | archived
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Таблица `fact_relations` (рёбра графа)

```sql
CREATE TABLE fact_relations (
  id SERIAL PRIMARY KEY,
  source_fact_id INTEGER REFERENCES facts(id),
  target_fact_id INTEGER REFERENCES facts(id),
  relation_type TEXT CHECK (relation_type IN (...)),
  weight DECIMAL(3,2) DEFAULT 0.50,  -- Сила связи
  description TEXT,                   -- Описание связи
  created_at TIMESTAMPTZ,
  UNIQUE(source_fact_id, target_fact_id, relation_type)
);
```

### Индексы для графовых запросов

```sql
-- Быстрый поиск исходящих связей
CREATE INDEX idx_relations_source ON fact_relations(source_fact_id);

-- Быстрый поиск входящих связей
CREATE INDEX idx_relations_target ON fact_relations(target_fact_id);

-- Фильтрация по типу связи
CREATE INDEX idx_relations_type ON fact_relations(relation_type);
```

## Примеры запросов

### 1. Найти все факты, влияющие на текущий

```sql
SELECT f.*, fr.relation_type, fr.weight
FROM facts f
JOIN fact_relations fr ON f.id = fr.source_fact_id
WHERE fr.target_fact_id = 9  -- FlyNav
  AND fr.relation_type IN ('influences', 'applies_to')
ORDER BY fr.weight DESC;
```

### 2. Построить граф зависимостей (BFS)

```sql
WITH RECURSIVE fact_tree AS (
  -- Начальный узел
  SELECT id, title, 0 as depth
  FROM facts
  WHERE id = 1
  
  UNION ALL
  
  -- Рекурсивный обход
  SELECT f.id, f.title, ft.depth + 1
  FROM facts f
  JOIN fact_relations fr ON f.id = fr.target_fact_id
  JOIN fact_tree ft ON fr.source_fact_id = ft.id
  WHERE ft.depth < 3  -- Глубина 3 уровня
)
SELECT * FROM fact_tree;
```

### 3. Найти самые связанные факты (хабы)

```sql
SELECT 
  f.id,
  f.title,
  COUNT(fr.id) as connections
FROM facts f
LEFT JOIN fact_relations fr 
  ON f.id = fr.source_fact_id OR f.id = fr.target_fact_id
GROUP BY f.id, f.title
ORDER BY connections DESC
LIMIT 10;
```

## Алгоритм миграции

### Этап 1: Дедупликация

```typescript
const seenTitles = new Set<string>();
facts.forEach(fact => {
  const key = fact.title.trim().toLowerCase();
  if (seenTitles.has(key)) {
    console.log(`Пропущен дубликат: ${fact.title}`);
    return; // Настоящий дубликат текста
  }
  seenTitles.add(key);
});
```

### Этап 2: Разрешение коллизий ID

```typescript
const seenIds = new Set<number>();
let maxId = Math.max(...facts.map(f => f.id));

facts.forEach(fact => {
  if (seenIds.has(fact.id)) {
    maxId++;
    console.log(`Переназначен ID ${fact.id} → ${maxId}`);
    fact.id = maxId; // Уникальный смысл получает новый ID
  }
  seenIds.add(fact.id);
});
```

### Этап 3: Построение типизированных связей

```typescript
function buildTypedRelations(facts: YasFact[]): FactRelation[] {
  const relations: FactRelation[] = [];
  
  facts.forEach(source => {
    source.relations?.forEach(targetId => {
      const target = factsMap.get(targetId);
      const type = inferRelationType(source, target);
      
      relations.push({
        source_fact_id: source.id,
        target_fact_id: targetId,
        relation_type: type,
        weight: 0.5
      });
    });
  });
  
  return relations;
}
```

### Этап 4: Атомарная загрузка

```typescript
// 1. Очистка
await supabase.from('fact_relations').delete().neq('id', 0);
await supabase.from('facts').delete().neq('id', 0);

// 2. Загрузка фактов
await supabase.from('facts').insert(cleanFacts);

// 3. Загрузка связей
await supabase.from('fact_relations').insert(typedRelations);
```

## Визуализация графа (планируется)

### Force-Directed Layout

```typescript
// Узлы = факты
nodes = facts.map(f => ({
  id: f.id,
  label: f.title,
  weight: f.weight,
  category: f.category
}));

// Рёбра = связи
edges = relations.map(r => ({
  source: r.source_fact_id,
  target: r.target_fact_id,
  type: r.relation_type,
  weight: r.weight
}));

// Физическая симуляция
forceSimulation(nodes)
  .force('link', forceLink(edges))
  .force('charge', forceManyBody())
  .force('center', forceCenter());
```

## Метрики качества графа

### 1. Связность

```
Средняя связность = Количество связей / Количество фактов
Цель: > 2.0 (каждый факт связан минимум с 2 другими)
```

### 2. Плотность

```
Плотность = 2 × Связей / (Узлов × (Узлов - 1))
Цель: 0.05 - 0.15 (не слишком разреженный, не слишком плотный)
```

### 3. Центральность

```sql
-- Узлы с наибольшей центральностью (хабы знаний)
SELECT id, title, degree_centrality
FROM facts_with_stats
ORDER BY total_relations_count DESC;
```

## Roadmap

### Phase 1: Фундамент ✅
- [x] Нормализованная схема БД
- [x] TypeScript типы
- [x] Скрипт миграции v2.0
- [x] Документация архитектуры

### Phase 2: Визуализация (в работе)
- [ ] Next.js приложение
- [ ] Canvas-based граф
- [ ] Force-directed layout
- [ ] Интерактивный выбор узлов

### Phase 3: AI Integration
- [ ] Gemini API для извлечения связей
- [ ] Автоматическая типизация связей
- [ ] Рекомендации новых связей
- [ ] Поиск противоречий

### Phase 4: Аналитика
- [ ] Метрики графа
- [ ] Временная эволюция
- [ ] Кластеризация знаний
- [ ] Экспорт в Neo4j

---

**Принцип YAS**: "Если фундамент слаб — рефакторим. Если архитектура правильная — масштабируем."
