import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(request: Request) {
  try {
    const { rawText } = await request.json();

    if (!rawText || rawText.trim() === '') {
      return NextResponse.json({ success: false, message: 'Входящий поток пуст' }, { status: 400 });
    }

    const { data: existingFacts } = await supabase.from('facts').select('id, title, category');
    const maxId = existingFacts && existingFacts.length > 0 ? Math.max(...existingFacts.map(f => f.id)) : 0;
    const nextId = maxId + 1;

    const systemPrompt = `
      Ты — ИИ-модуль валидации и разметки Цифрового Двойника YAS (Архитектор Андрей Яровиков).
      Твоя задача — пропустить сырой текст через Шлюз Шумоподавления и вернуть строго валидный JSON.

      КРИТЕРИЙ ШУМОПОДАВЛЕНИЯ:
      Если входящий текст является мимолётной эмоцией, бытовым шумом, бредом или "бананами в борще" (не имеющими отношения к системному развитию, ИТ-архитектуре, авиатеху, юриспруденции, спорту Саньда или семье Андрея) — ты ОБЯЗАН заблокировать запись, вернув "status": "REJECT".

      Текущие факты в системе для построения связей (relations):
      ${JSON.stringify(existingFacts || [])}

      Новый ID для факта: ${nextId}.

      Выдай ответ СТРОГО в формате JSON по следующей схеме (без markdown-разметки):
      {
        "status": "VALID" или "REJECT",
        "rejectReason": "Причина блокировки, если статус REJECT",
        "fact": {
          "id": ${nextId},
          "title": "Техническое название инсайта",
          "content": "Структурированный, очищенный от мусора текст факта",
          "category": "Категория",
          "section": "Секция",
          "weight": 0.70,
          "relations": [ID связанных фактов из списка выше, если они есть]
        }
      }
    `;

    const geminiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nВходящий поток от пользователя:\n"${rawText}"` }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    const geminiData = await geminiResponse.json();
    const aiResult = JSON.parse(geminiData.candidates[0].content.parts[0].text);

    if (aiResult.status === 'REJECT') {
      return NextResponse.json({
        success: false,
        message: `Шлюз Шумоподавления заблокировал запись: ${aiResult.rejectReason}`
      }, { status: 422 });
    }

    // Поддержка нового формата: { new_fact, inferred_relations }
    const factToInsert = aiResult.new_fact || aiResult.fact;
    if (!factToInsert) throw new Error('AI response missing fact payload');

    const { data: categoryRows } = await supabase.from('categories').select('id,name');
    const { data: sectionRows } = await supabase.from('sections').select('id,name');
    const categoryMap = new Map((categoryRows || []).map((c: any) => [c.name.trim().toLowerCase(), c.id]));
    const sectionMap = new Map((sectionRows || []).map((s: any) => [s.name.trim().toLowerCase(), s.id]));

    const { data: sampleFacts } = await supabase.from('facts').select('*').limit(1);
    const existingFactColumns = new Set<string>();
    if (sampleFacts && sampleFacts.length > 0) {
      Object.keys(sampleFacts[0]).forEach(column => existingFactColumns.add(column));
    } else {
      ['title', 'content', 'category_id', 'section_id', 'category', 'section', 'weight', 'hpi_impact_sphere', 'energy_cost', 'voltage_generation', 'created_at'].forEach(column => existingFactColumns.add(column));
    }
    const hasFactColumn = (name: string) => existingFactColumns.has(name);

    const factRow: any = {
      title: factToInsert.title,
      content: factToInsert.content,
      weight: factToInsert.weight || 0.7,
      hpi_impact_sphere: factToInsert.metrics?.hpi_impact_sphere || null,
      energy_cost: factToInsert.metrics?.energy_cost || null,
      voltage_generation: factToInsert.metrics?.voltage_generation || null,
      created_at: new Date().toISOString()
    };

    if (factToInsert.category_id) {
      factRow.category_id = factToInsert.category_id;
    } else if (factToInsert.category) {
      factRow.category_id = categoryMap.get(factToInsert.category.trim().toLowerCase()) || 1;
      if (hasFactColumn('category')) {
        factRow.category = factToInsert.category;
      }
    }

    if (factToInsert.section_id) {
      factRow.section_id = factToInsert.section_id;
    } else if (factToInsert.section) {
      factRow.section_id = sectionMap.get(factToInsert.section.trim().toLowerCase()) || 1;
      if (hasFactColumn('section')) {
        factRow.section = factToInsert.section;
      }
    }

    // Insert fact and get assigned id
    const { data: insertedFacts, error: insertError } = await supabase.from('facts').insert([factRow]).select();
    if (insertError) throw new Error(insertError.message);

    const createdFact = insertedFacts[0];

    // If AI provided inferred_relations, insert them into fact_relations
    const relations = aiResult.inferred_relations || factToInsert.relations || [];
    if (relations && relations.length > 0) {
      const relRows = relations.map((r: any) => ({
        source_id: createdFact.id,
        target_id: r.target_id,
        relation_type: r.relation_type || 'INFLUENCES',
        relation_strength: typeof r.relation_strength === 'number' ? r.relation_strength : (factRow.weight || 1.0),
        created_at: new Date().toISOString()
      }));

      const { error: relError } = await supabase.from('fact_relations').insert(relRows);
      if (relError) console.warn('Warning: could not insert relations:', relError.message);
    }

    return NextResponse.json({
      success: true,
      message: `Интегрирован Факт: ${createdFact.title}`,
      data: createdFact
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
