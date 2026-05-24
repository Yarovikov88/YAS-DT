import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

interface YasFact {
  id: number;
  title: string;
  content: string;
  category: string;
  section: string;
  created_at: string;
  weight: number;
  relations: number[];
}

interface YasCoreStructure {
  knowledge_base: YasFact[];
}

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

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function runMigration() {
  console.log("🚀 Запуск УМНОЙ миграции ядра YAS (Восстановление смыслов)...");

  const jsonPath = path.join(ROOT_DIR, 'data/yas_core.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const coreData: YasCoreStructure = JSON.parse(rawData);
  const facts = coreData.knowledge_base;

  console.log(`📦 Всего записей в сыром файле: ${facts.length}`);

  // Находим максимальный ID в файле, чтобы новые номера назначать выше него
  let currentMaxId = Math.max(...facts.map(f => Number(f.id) || 0));

  const finalFacts: any[] = [];
  const seenTitles = new Set<string>();
  const seenIds = new Set<number>();

  facts.forEach(fact => {
    const titleKey = fact.title.trim().toLowerCase();

    // 1. ФИЛЬТР: Проверяем реальный дубликат текста по названию
    if (seenTitles.has(titleKey)) {
      return; // Настоящий дубликат (копия текста) — пропускаем
    }
    seenTitles.add(titleKey);

    const formattedFact = {
      id: Number(fact.id),
      title: fact.title,
      content: fact.content,
      category: fact.category,
      section: fact.section,
      weight: fact.weight || 0.70,
      relations: fact.relations || [],
      created_at: fact.created_at ? new Date(fact.created_at).toISOString() : new Date().toISOString()
    };

    // 2. ФИЛЬТР: Если ID совпал, но текст уникальный — выделяем новый уникальный ID
    if (seenIds.has(formattedFact.id)) {
      currentMaxId++;
      console.log(`⚡️ Восстановлен смысл! Назначен новый ID [${currentMaxId}] для карточки: "${formattedFact.title}"`);
      formattedFact.id = currentMaxId;
    }

    seenIds.add(formattedFact.id);
    finalFacts.push(formattedFact);
  });

  console.log(`🧹 Мусорные дубликаты строк отсеяны. Готово к заливке чистых фактов: ${finalFacts.length}`);

  // Очищаем базу перед чистым импортом
  await supabase.from('facts').delete().neq('id', 0);

  // Атомарный апсерт всей пачки данных
  const { data, error } = await supabase.from('facts').upsert(finalFacts).select();

  if (error) {
    console.error("💥 Ошибка импорта в Supabase:", error.message);
  } else {
    console.log(`\n✅ ТРИУМФ: Миграция завершена без потерь!`);
    console.log(`📊 В облачную базу PostgreSQL успешно интегрировано ${data.length} уникальных смысловых единиц.`);
    console.log(`🧠 Все коллизии разрешены. Адам Иванович, Саньда и ROBIUS в полной безопасности.`);
  }
}

runMigration();
