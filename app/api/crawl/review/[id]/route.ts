import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import createServerClient from '@/db/supabase/server';

export const runtime = 'nodejs';

function slugFromDomain(domain: string) {
  return domain
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export async function POST(req: NextRequest, { params: { id } }: { params: { id: string } }) {
  const authHeader = req.headers.get('authorization');
  const reviewKey = process.env.REVIEW_AUTH_KEY || process.env.CRON_AUTH_KEY;
  if (!reviewKey || authHeader !== `Bearer ${reviewKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { action?: 'approve' | 'reject'; categoryName?: string };
  if (!['approve', 'reject'].includes(body.action || '')) {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: candidate, error } = await supabase.from('crawl_candidate').select().eq('id', Number(id)).single();
  if (error || !candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  if (candidate.status !== 'review') {
    return NextResponse.json({ error: 'Candidate is not awaiting review' }, { status: 409 });
  }

  if (body.action === 'reject') {
    await Promise.all([
      supabase
        .from('crawl_candidate')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', candidate.id),
      candidate.source === 'submission'
        ? supabase.from('submit').update({ status: 2 }).eq('id', Number(candidate.source_item_id))
        : Promise.resolve(),
    ]);
    return NextResponse.json({ message: 'Rejected' });
  }

  if (!candidate.title || !candidate.description || !candidate.detail) {
    return NextResponse.json({ error: 'Candidate content is incomplete' }, { status: 409 });
  }

  const categoryName = body.categoryName || candidate.category_name || 'other';
  let slug = slugFromDomain(candidate.domain);
  const { data: existing } = await supabase
    .from('web_navigation')
    .select('id,name')
    .eq('url', candidate.canonical_url)
    .maybeSingle();
  if (!existing) {
    const { data: slugOwner } = await supabase.from('web_navigation').select('id').eq('name', slug).maybeSingle();
    if (slugOwner) slug = `${slug}-${candidate.id}`;
  }
  const record = {
    category_name: categoryName,
    collection_time: new Date().toISOString(),
    content: candidate.description,
    detail: candidate.detail,
    image_url: candidate.image_url,
    name: existing?.name || slug,
    tag_name: categoryName,
    thumbnail_url: candidate.image_url,
    title: candidate.title,
    url: candidate.canonical_url,
  };
  const saveResult = existing
    ? await supabase.from('web_navigation').update(record).eq('id', existing.id)
    : await supabase.from('web_navigation').insert(record);
  if (saveResult.error) {
    return NextResponse.json({ error: saveResult.error.message }, { status: 500 });
  }

  await Promise.all([
    supabase
      .from('crawl_candidate')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', candidate.id),
    candidate.source === 'submission'
      ? supabase.from('submit').update({ status: 1 }).eq('id', Number(candidate.source_item_id))
      : Promise.resolve(),
  ]);
  revalidatePath('/');
  revalidatePath('/explore');
  revalidatePath(`/category/${categoryName}`);
  revalidatePath(`/ai/${record.name}`);
  return NextResponse.json({ message: 'Published', name: record.name });
}
