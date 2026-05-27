# Ответ на ревью v1.0

Спасибо за аудит. Уточнение: **смотрел старый `main`**. Актуальная архитектура живёт в ветке `feature/dt-yas-v2.1` под тегом `v2.2.0` — она готова к мерджу.

## Что уже сделано (закрыто из ревью)

1. **Версия `3.0.0`** → исправлена на `2.2.0`. Старый артефакт от Copilot.

2. **Плоский `relations: number[]`** → удалён. Теперь:
   - Таблица `fact_relations` с FK на `facts(id)` и каскадным удалением
   - Поле `relation_type` с 10 типизированными значениями (`causes`, `influences`, `supports`, `prerequisite_for`, `applies_to`, `similar_to`, `contradicts`, `derives_from`, `part_of`, `related_to`)
   - Отдельный `weight` ребра (0-1)

3. **Двухпроходный парсер** → реализован в `scripts/migrate-v2.ts`. Дедупликация по title, переназначение коллизий ID, инференс типа связи по содержимому, атомарная заливка узлов и потом рёбер с проверкой существования target_id.

4. **API `/api/graph`** → отдаёт `{ nodes, edges, stats }`. Узлы включают `sphere`, `tags`, `content`, `weight`, `age`.

5. **Интерактивный UI** → готов:
   - SVG-граф с force-directed раскладкой
   - Физика в Web Worker (не блокирует UI)
   - Pan/zoom через ref → можно держать 1000 узлов
   - Hover через CSS, фильтры по сфере и тегу, поиск

## Что **сделано иначе** и почему

### 1. Поля HPI не на узле

В ревью предлагается `hpi_impact_sphere`, `energy_cost`, `voltage_generation` прямо в `YasFact`. Это коллапсирует размерность — один факт обычно влияет на 2-3 сферы.

**Решение**: эти метрики поедут в отдельную таблицу:

```sql
CREATE TABLE fact_sphere_impact (
  fact_id   INTEGER REFERENCES facts(id) ON DELETE CASCADE,
  sphere    TEXT,
  energy_cost          NUMERIC(3,2),
  voltage_generation   NUMERIC(3,2),
  PRIMARY KEY (fact_id, sphere)
);
```

Это даст полноценные HPI-расчёты по протоколу 8888 без потери данных. Не входит в текущий PR — следующая итерация.

### 2. Тип связи не `INFLUENCES` по умолчанию

В ревью все легаси-связи получают один тип. Это убивает семантику.

**Решение**: функция `inferRelationType(source, target)` в `migrate-v2.ts` смотрит на содержимое и выбирает тип:
- `"основа"`, `"фундамент"` → `prerequisite_for`
- `"влия"` → `influences`
- `"причин"`, `"следств"` → `causes`
- та же секция → `related_to`
- по умолчанию → `related_to` (а не `INFLUENCES`)

При желании этот же шаг можно прогнать через Gemini для более точной разметки — инфраструктура для этого есть (`scripts/classify-facts.ts` уже работает).

### 3. Категории заменены на сферы HPI + теги

Старая `category` была свалкой из типов знания (Принцип, Кейс, Философия) и контекстов (Военный, ИТ, Юридический). Это разные оси.

**Решение**:
- **`sphere`** (1 на факт) — 8 сфер HPI: `loved`, `family`, `friends`, `career`, `physical`, `mental`, `hobby`, `wealth`
- **`tags TEXT[]`** (много на факт) — тип знания + контекст + жизненный этап

Все 196 фактов уже классифицированы через Gemini, бэкап в `data/classifications.json`.

## Состояние

```
ветка:   feature/dt-yas-v2.1
тег:     v2.2.0
коммитов: 5
PR:      https://github.com/Yarovikov88/YAS-DT/pull/new/feature/dt-yas-v2.1
```

Готов мержить в `main`.
