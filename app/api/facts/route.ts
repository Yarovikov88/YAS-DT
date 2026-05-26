import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const category = searchParams.get('category');
  const section = searchParams.get('section');
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    let query = supabase
      .from('facts')
      .select('*')
      .eq('status', 'active')
      .order('weight', { ascending: false })
      .limit(limit);

    if (id) {
      query = query.eq('id', id);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (section) {
      query = query.eq('section', section);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
