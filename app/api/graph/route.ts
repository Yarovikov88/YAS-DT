import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: facts, error: factsErr } = await supabase.from('facts').select('id,title,weight,category_id,section_id');
    if (factsErr) throw new Error(factsErr.message);

    const { data: categories, error: catErr } = await supabase.from('categories').select('id,name');
    if (catErr) throw new Error(catErr.message);

    const { data: sections, error: secErr } = await supabase.from('sections').select('id,name');
    if (secErr) throw new Error(secErr.message);

    const { data: relations, error: relErr } = await supabase.from('fact_relations').select('*');
    if (relErr) throw new Error(relErr.message);

    const categoryMap = new Map((categories || []).map((c: any) => [c.id, c.name]));
    const sectionMap = new Map((sections || []).map((s: any) => [s.id, s.name]));

    const nodes = (facts || []).map((f: any) => ({
      id: f.id,
      label: f.title,
      category: categoryMap.get(f.category_id) || null,
      section: sectionMap.get(f.section_id) || null,
      weight: Number(f.weight) || 1.0
    }));

    const edges = (relations || []).map((r: any) => ({
      id: r.id,
      source: r.source_id,
      target: r.target_id,
      type: r.relation_type,
      weight: Number(r.relation_strength) || 1.0
    }));

    return NextResponse.json({ nodes, edges });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
