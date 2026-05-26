import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const ROOT_DIR = process.cwd();

// Чтение .env.local
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

async function applySchema() {
  console.log("🚀 Применение SQL-схемы к Supabase...\n");

  const schemaPath = path.join(ROOT_DIR, 'scripts/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Разбиваем SQL на отдельные команды
  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📝 Найдено ${statements.length} SQL-команд\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    
    // Пропускаем комментарии
    if (statement.trim().startsWith('COMMENT')) {
      console.log(`⏭️  Пропущен комментарий ${i + 1}/${statements.length}`);
      continue;
    }

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        // Игнорируем ошибки "already exists"
        if (error.message.includes('already exists')) {
          console.log(`✓ Команда ${i + 1}/${statements.length} - уже существует`);
          successCount++;
        } else {
          console.error(`✗ Ошибка в команде ${i + 1}:`, error.message);
          errorCount++;
        }
      } else {
        console.log(`✓ Команда ${i + 1}/${statements.length} выполнена`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`✗ Ошибка в команде ${i + 1}:`, err.message);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Успешно: ${successCount}`);
  console.log(`❌ Ошибок: ${errorCount}`);
  console.log("=".repeat(60));

  if (errorCount === 0) {
    console.log("\n🎉 SQL-схема успешно применена!");
  } else {
    console.log("\n⚠️  Некоторые команды завершились с ошибками.");
    console.log("Это нормально, если таблицы уже существуют.");
  }
}

applySchema().catch(console.error);
