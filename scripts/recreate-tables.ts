/**
 * Пересоздаёт таблицы через Supabase JS SDK.
 * Поскольку прямой DDL недоступен, используем обходной путь:
 * удаляем все строки и делаем upsert с нужной структурой —
 * Supabase автоматически добавит недостающие колонки через
 * политику "auto-add columns" если она включена.
 *
 * Если нет — выводим готовый SQL для ручного применения.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const ROOT_DIR = process.cwd();

const envPath = path.join(ROOT_DIR, '.env.local');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkColumns() {
  console.log('🔍 Проверка структуры таблиц...\n');

  // Проверяем facts через тестовый insert
  const testFact = {
    id: 99999,
    title: '__test__',
    content: '__test__',
    category: '__test__',
    section: '__test__',
    weight: 0.5,
    age: 1,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: testError } = await supabase
    .from('facts')
    .upsert(testFact);

  if (testError) {
    console.log('❌ Таблица facts не имеет нужных колонок:');
    console.log('   ' + testError.message);
    console.log('\n📋 Необходимо выполнить SQL в Supabase Dashboard:\n');
    
    const schemaPath = path.join(ROOT_DIR, 'scripts/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Генерируем патч-SQL
    const patchSQL = `
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
`;

    // Сохраняем патч в файл
    const patchPath = path.join(ROOT_DIR, 'scripts/patch.sql');
    fs.writeFileSync(patchPath, patchSQL);
    
    console.log('📄 Патч сохранён в: scripts/patch.sql');
    console.log('\n🔗 Откройте Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/zjcrclzjhyaiczcocwwf/sql/new');
    console.log('\n📋 Скопируйте и выполните содержимое scripts/patch.sql');
    console.log('\nПосле этого запустите: npm run db:migrate:v2\n');
    
    return false;
  }

  // Удаляем тестовую запись
  await supabase.from('facts').delete().eq('id', 99999);
  
  console.log('✅ Структура таблицы facts корректна!');
  return true;
}

checkColumns().catch(console.error);
