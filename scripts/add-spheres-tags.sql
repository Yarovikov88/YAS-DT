-- YAS-DT v2.2: Sphere + Tags structure
-- Выполните в Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/zjcrclzjhyaiczcocwwf/sql/new

-- 1. Добавляем колонку для сферы (8 сфер HPI: один-к-одному с фактом)
ALTER TABLE facts ADD COLUMN IF NOT EXISTS sphere TEXT;

-- 2. Добавляем массив тегов (много на факт)
ALTER TABLE facts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 3. Индексы для быстрой фильтрации
CREATE INDEX IF NOT EXISTS idx_facts_sphere ON facts(sphere);
CREATE INDEX IF NOT EXISTS idx_facts_tags   ON facts USING GIN(tags);

-- 4. Опциональный CHECK на допустимые сферы (8 сфер HPI)
-- Раскомментируйте после успешной миграции данных:
-- ALTER TABLE facts ADD CONSTRAINT facts_sphere_check
--   CHECK (sphere IN ('loved','family','friends','career','physical','mental','hobby','wealth'));
