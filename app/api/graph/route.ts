import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: facts, error: factsErr } = await supabase.from('facts').select('*');
    if (factsErr) throw new Error(factsErr.message);

    const { data: relations, error: relErr } = await supabase.from('fact_relations').select('*');
    if (relErr) throw new Error(relErr.message);

    const nodes = (facts || []).map((f: any) => ({
      id: f.id,
      label: f.title,
      category: f.category || f.category_id || null,
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
