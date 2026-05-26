
-- Патч для существующих таблиц YAS-DT v2.1
-- Выполните этот SQL в Supabase Dashboard → SQL Editor

-- 1. Добавляем колонки в facts
ALTER TABLE facts ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE facts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE facts ADD COLUMN IF NOT EXISTS weight DECIMAL(3,2) DEFAULT 0.70;
ALTER TABLE facts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Добавляем колонки в sections
ALTER TABLE sections ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS "order" INTEGER;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Добавляем колонки в categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Создаём таблицу fact_relations
CREATE TABLE IF NOT EXISTS fact_relations (
  id SERIAL PRIMARY KEY,
  source_fact_id INTEGER NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  target_fact_id INTEGER NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  weight DECIMAL(3,2) DEFAULT 0.50,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_fact_id, target_fact_id, relation_type)
);

-- 5. Индексы
CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
CREATE INDEX IF NOT EXISTS idx_facts_section ON facts(section);
CREATE INDEX IF NOT EXISTS idx_facts_status ON facts(status);
CREATE INDEX IF NOT EXISTS idx_relations_source ON fact_relations(source_fact_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON fact_relations(target_fact_id);
CREATE INDEX IF NOT EXISTS idx_relations_type ON fact_relations(relation_type);
