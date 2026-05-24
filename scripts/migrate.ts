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
      original_category: fact.category,
      original_section: fact.section,
      weight: fact.weight || 0.70,
      relations: updatedRelations,
      created_at: fact.created_at ? new Date(fact.created_at).toISOString() : new Date().toISOString()
    };
  });

  // 5. Чистая заливка
  console.log("⚡️ Заливка нормализованной матрицы смыслов...");
  let data: any = null;
  let error: any = null;

  try {
    const res = await supabase.from('facts').insert(finalFacts).select();
    data = res.data;
    error = res.error;
  } catch (e: any) {
    error = e;
  }

  if (error) {
    console.error("💥 Ошибка импорта при вставке с category_id/section_id:", error.message || error);
    // Попытка fallback: вставить как plain category/section (строки), если в БД нет колонок category_id/section_id
    try {
      const fallback = finalFacts.map(f => ({
        title: f.title,
        content: f.content,
        category: (f as any).original_category || 'uncategorized',
        section: (f as any).original_section || 'default',
        weight: f.weight,
        created_at: f.created_at
      }));

      const res2 = await supabase.from('facts').insert(fallback).select();
      data = res2.data;
      error = res2.error;
      if (error) {
        console.error('💥 Ошибка импорта при fallback вставке:', error.message || error);
      } else {
        console.log('✅ Fallback вставка facts выполнена успешно (category/section).');
      }
    } catch (e: any) {
      console.error('💥 Исключение при fallback вставке:', e.message || e);
    }
  } else {
    console.log(`\n🏆 МАГИСТЕРСКИЙ ТРИУМФ: Схема нормализована до 3NF!`);
    console.log(`📊 Залито чистых строк: ${data.length} (номера с 1 по ${data.length})`);
  }

  // 6. Подготовка и заливка ребер графа (fact_relations)
  if (data && data.length > 0) {
    console.log(`🔗 Подготавливаю вставку relations в таблицу fact_relations...`);

    // Построим мапы для соответствия локальных newId -> заголовок -> реальный id в БД
    const titleToInsertedId = new Map<string, number>();
    (data as any[]).forEach((row: any) => {
      if (row.title) titleToInsertedId.set(row.title, row.id);
    });

    const newIdToTitle = new Map<number, string>();
    finalFacts.forEach(f => {
      newIdToTitle.set(f.id, f.title);
    });

    const relationRows: Array<any> = [];
    finalFacts.forEach(f => {
      const srcActual = titleToInsertedId.get(f.title) || f.id;
      const strengthDefault = typeof f.weight === 'number' ? f.weight : 1.0;
      (f.relations || []).forEach((tId: number) => {
        const targetTitle = newIdToTitle.get(tId);
        const tgtActual = targetTitle ? (titleToInsertedId.get(targetTitle) || tId) : tId;
        relationRows.push({
          source_id: srcActual,
          target_id: tgtActual,
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
  } else {
    console.log('🔗 Пропускаю вставку relations — не было успешно вставленных facts.');
  }
}

runMigration();
