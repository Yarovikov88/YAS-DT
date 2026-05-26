import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const factId = searchParams.get('id');

  try {
    // Получаем все факты
    const { data: facts, error: factsError } = await supabase
      .from('facts')
      .select('*')
      .eq('status', 'active');

    if (factsError) {
      return NextResponse.json({ error: factsError.message }, { status: 500 });
    }

    // Получаем все связи
    let relationsQuery = supabase
      .from('fact_relations')
      .select('*');

    // Если указан конкретный факт, получаем только его связи
    if (factId) {
      relationsQuery = relationsQuery.or(
        `source_fact_id.eq.${factId},target_fact_id.eq.${factId}`
      );
    }

    const { data: relations, error: relationsError } = await relationsQuery;

    if (relationsError) {
      return NextResponse.json({ error: relationsError.message }, { status: 500 });
    }

    // Формируем граф в формате для визуализации
    const nodes = facts.map(fact => ({
      id: fact.id,
      label: fact.title,
      category: fact.category,
      section: fact.section,
      weight: fact.weight,
      age: fact.age
    }));

    const edges = relations.map(rel => ({
      source: rel.source_fact_id,
      target: rel.target_fact_id,
      type: rel.relation_type,
      weight: rel.weight,
      description: rel.description
    }));

    return NextResponse.json({
      success: true,
      graph: {
        nodes,
        edges,
        stats: {
          nodes_count: nodes.length,
          edges_count: edges.length,
          avg_degree: edges.length / nodes.length
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
