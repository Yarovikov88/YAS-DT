-- YAS-DT v2.1: Полный сброс и пересоздание схемы
-- Выполните в Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/zjcrclzjhyaiczcocwwf/sql/new

-- Шаг 1: Удаляем старые таблицы (каскадно)
DROP TABLE IF EXISTS fact_relations CASCADE;
DROP TABLE IF EXISTS facts CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Шаг 2: Создаём таблицу категорий
CREATE TABLE categories (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Шаг 3: Создаём таблицу секций
CREATE TABLE sections (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  "order" INTEGER
);

-- Шаг 4: Создаём основную таблицу фактов
CREATE TABLE facts (
  id         INTEGER PRIMARY KEY,
  title      TEXT         NOT NULL,
  content    TEXT         NOT NULL,
  category   TEXT         NOT NULL,
  section    TEXT         NOT NULL,
  weight     NUMERIC(3,2) DEFAULT 0.70,
  age        INTEGER,
  status     TEXT         DEFAULT 'active',
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

-- Шаг 5: Создаём таблицу связей
CREATE TABLE fact_relations (
  id             SERIAL PRIMARY KEY,
  source_fact_id INTEGER      NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  target_fact_id INTEGER      NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  relation_type  TEXT         NOT NULL,
  weight         NUMERIC(3,2) DEFAULT 0.50,
  description    TEXT,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(source_fact_id, target_fact_id, relation_type)
);

-- Шаг 6: Индексы
CREATE INDEX idx_facts_category   ON facts(category);
CREATE INDEX idx_facts_section    ON facts(section);
CREATE INDEX idx_facts_status     ON facts(status);
CREATE INDEX idx_relations_source ON fact_relations(source_fact_id);
CREATE INDEX idx_relations_target ON fact_relations(target_fact_id);
CREATE INDEX idx_relations_type   ON fact_relations(relation_type);
