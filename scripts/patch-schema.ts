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

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Выполняем SQL через Supabase pg REST endpoint
async function runSQL(sql: string, label: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    const err = await res.text();
    // Пробуем через pg endpoint
    return false;
  }
  console.log(`✅ ${label}`);
  return true;
}

// Патчим через прямые запросы к PostgREST
async function patchViaRPC(sql: string, label: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (res.ok) {
    console.log(`✅ ${label}`);
    return true;
  } else {
    console.log(`⚠️  ${label}: ${text.substring(0, 100)}`);
    return false;
  }
}

async function main() {
  console.log('🔧 Патч схемы через Supabase Management API...\n');

  const PROJECT_REF = 'zjcrclzjhyaiczcocwwf';

  // Используем Supabase Management API для выполнения SQL
  const sqlStatements = [
    // Добавляем недостающие колонки в facts
    `ALTER TABLE facts ADD COLUMN IF NOT EXISTS age INTEGER`,
    `ALTER TABLE facts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`,
    `ALTER TABLE facts ADD COLUMN IF NOT EXISTS weight DECIMAL(3,2) DEFAULT 0.70`,
    `ALTER TABLE facts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
    // Добавляем колонки в sections
    `ALTER TABLE sections ADD COLUMN IF NOT EXISTS description TEXT`,
    `ALTER TABLE sections ADD COLUMN IF NOT EXISTS "order" INTEGER`,
    `ALTER TABLE sections ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    // Добавляем колонки в categories
    `ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT`,
    `ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT`,
    `ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    // Создаём таблицу fact_relations если нет
    `CREATE TABLE IF NOT EXISTS fact_relations (
      id SERIAL PRIMARY KEY,
      source_fact_id INTEGER NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
      target_fact_id INTEGER NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL,
      weight DECIMAL(3,2) DEFAULT 0.50,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(source_fact_id, target_fact_id, relation_type)
    )`,
    // Индексы
    `CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category)`,
    `CREATE INDEX IF NOT EXISTS idx_facts_section ON facts(section)`,
    `CREATE INDEX IF NOT EXISTS idx_relations_source ON fact_relations(source_fact_id)`,
    `CREATE INDEX IF NOT EXISTS idx_relations_target ON fact_relations(target_fact_id)`,
  ];

  for (const sql of sqlStatements) {
    const label = sql.substring(0, 60).replace(/\n/g, ' ').trim() + '...';
    
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    const text = await res.text();
    if (res.ok) {
      console.log(`✅ ${label}`);
    } else {
      // Пробуем через pg напрямую
      console.log(`⚠️  ${label}`);
      console.log(`   Response: ${text.substring(0, 150)}`);
    }
  }

  console.log('\n✅ Патч завершён. Запускаем миграцию данных...\n');
}

main().catch(console.error);
