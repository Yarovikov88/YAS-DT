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
  console.log("🚀 Запуск ИСПРАВЛЕННОЙ 3NF миграции...");

  const jsonPath = path.join(ROOT_DIR, 'data/yas_core.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const coreData: YasCoreStructure = JSON.parse(rawData);
  const facts = coreData.knowledge_base;

  // 1. Отсекаем дубликаты текстов
  const uniqueFacts: YasFact[] = [];
  const seenTitles = new Set<string>();
  facts.forEach(f => {
    const t = f.title.trim().toLowerCase();
    if (!seenTitles.has(t)) {
      seenTitles.add(t);
      uniqueFacts.push(f);
    }
  });

  console.log(`🧹 Найдено уникальных смыслов: ${uniqueFacts.length}`);

  // 2. Выделяем уникальные категории и секции для справочников
  const uniqueCategories = Array.from(new Set(uniqueFacts.map(f => f.category.trim())));
  const uniqueSections = Array.from(new Set(uniqueFacts.map(f => f.section.trim())));

  // Выкачиваем ID категорий и секций из БД
  const { data: dbCats } = await supabase.from('categories').select('*');
  const { data: dbSecs } = await supabase.from('sections').select('*');

  const catMap = new Map(dbCats?.map(c => [c.name.toLowerCase(), c.id]));
  const secMap = new Map(dbSecs?.map(s => [s.name.toLowerCase(), s.id]));

  // 3. Строим карту для перелинковки связей (массив relations)
  const idMap = new Map<number, number>();
  uniqueFacts.forEach((f, idx) => {
    if (!idMap.has(Number(f.id))) {
      idMap.set(Number(f.id), idx + 1);
    }
  });

  // 4. Пересобираем факты. ID берем НАПРЯМУЮ из индекса цикла
  const finalFacts = uniqueFacts.map((fact, index) => {
    const newId = index + 1; // ГАРАНТИЯ УНИКАЛЬНОСТИ 1..196

    const updatedRelations = (fact.relations || [])
      .map(rId => idMap.get(Number(rId)))
      .filter((rId): rId is number => rId !== undefined);

    return {
      id: newId, 
      title: fact.title,
      content: fact.content,
      category_id: catMap.get(fact.category.trim().toLowerCase()) || 1,
      section_id: secMap.get(fact.section.trim().toLowerCase()) || 1,
      weight: fact.weight || 0.70,
      relations: updatedRelations,
      created_at: fact.created_at ? new Date(fact.created_at).toISOString() : new Date().toISOString()
    };
  });

  // 5. Чистая заливка
  console.log("⚡️ Заливка нормализованной матрицы смыслов...");
  const { data, error } = await supabase.from('facts').insert(finalFacts).select();

  if (error) {
    console.error("💥 Ошибка импорта:", error.message);
  } else {
    console.log(`\n🏆 МАГИСТЕРСКИЙ ТРИУМФ: Схема нормализована до 3NF!`);
    console.log(`📊 Залито чистых строк: ${data.length} (номера с 1 по ${data.length})`);
    console.log(`🔗 Подготавливаю вставку relations в таблицу fact_relations...`);

    // 6. Подготовка и заливка ребер графа (fact_relations)
    const relationRows: Array<any> = [];
    finalFacts.forEach(f => {
      const srcId = f.id;
      const strengthDefault = typeof f.weight === 'number' ? f.weight : 1.0;
      (f.relations || []).forEach((tId: number) => {
        relationRows.push({
          source_id: srcId,
          target_id: tId,
          relation_type: 'INFLUENCES',
          relation_strength: strengthDefault,
          created_at: f.created_at
        });
      });
    });

    if (relationRows.length > 0) {
      const { data: relData, error: relError } = await supabase.from('fact_relations').insert(relationRows).select();
      if (relError) {
        console.error('💥 Ошибка импорта relations:', relError.message);
      } else {
        console.log(`🔗 Залито relations: ${relData.length}`);
      }
    } else {
      console.log('🔗 Нет relations для заливки.');
    }
  }
}

runMigration();
