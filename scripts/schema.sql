-- YAS Digital Twin v2.0: Семантический граф знаний
-- Нормализованная схема базы данных

-- Таблица категорий
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица секций
CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  "order" INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Основная таблица фактов
CREATE TABLE IF NOT EXISTS facts (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  section TEXT NOT NULL,
  weight DECIMAL(3,2) DEFAULT 0.70,
  age INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица типизированных связей между фактами
CREATE TABLE IF NOT EXISTS fact_relations (
  id SERIAL PRIMARY KEY,
  source_fact_id INTEGER NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  target_fact_id INTEGER NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'causes',
    'influences', 
    'contradicts',
    'supports',
    'derives_from',
    'applies_to',
    'similar_to',
    'part_of',
    'prerequisite_for',
    'related_to'
  )),
  weight DECIMAL(3,2) DEFAULT 0.50,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_fact_id, target_fact_id, relation_type)
);

-- Индексы для оптимизации запросов графа
CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
CREATE INDEX IF NOT EXISTS idx_facts_section ON facts(section);
CREATE INDEX IF NOT EXISTS idx_facts_status ON facts(status);
CREATE INDEX IF NOT EXISTS idx_facts_weight ON facts(weight DESC);

CREATE INDEX IF NOT EXISTS idx_relations_source ON fact_relations(source_fact_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON fact_relations(target_fact_id);
CREATE INDEX IF NOT EXISTS idx_relations_type ON fact_relations(relation_type);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для facts
DROP TRIGGER IF EXISTS update_facts_updated_at ON facts;
CREATE TRIGGER update_facts_updated_at
  BEFORE UPDATE ON facts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Представление для фактов с количеством связей
CREATE OR REPLACE VIEW facts_with_stats AS
SELECT 
  f.*,
  COUNT(DISTINCT fr_out.id) as outgoing_relations_count,
  COUNT(DISTINCT fr_in.id) as incoming_relations_count,
  COUNT(DISTINCT fr_out.id) + COUNT(DISTINCT fr_in.id) as total_relations_count
FROM facts f
LEFT JOIN fact_relations fr_out ON f.id = fr_out.source_fact_id
LEFT JOIN fact_relations fr_in ON f.id = fr_in.target_fact_id
GROUP BY f.id;

-- Комментарии к таблицам
COMMENT ON TABLE facts IS 'Основная таблица фактов - узлы графа знаний';
COMMENT ON TABLE fact_relations IS 'Типизированные связи между фактами - рёбра графа';
COMMENT ON TABLE categories IS 'Категории для классификации фактов';
COMMENT ON TABLE sections IS 'Секции для структурирования знаний';
