/* eslint-disable react/jsx-props-no-spreading */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/db/supabase/client';

import { InfoPageSize, RevalidateOneHour } from '@/lib/constants';
import { languageAlternates } from '@/lib/seo';

import Content from '../../Content';

export const revalidate = RevalidateOneHour * 6;

export async function generateMetadata({
  params,
}: {
  params: { code: string; locale: string; pageNum?: string };
}): Promise<Metadata> {
  const supabase = createClient();
  const { data: categoryList } = await supabase.from('navigation_category').select().eq('name', params.code);

  if (!categoryList || !categoryList[0]) {
    notFound();
  }

  const page = Number(params.pageNum || 1);
  return {
    title: `${categoryList[0].title} · ${page}`,
    alternates: languageAlternates(params.locale, `/category/${params.code}/page/${page}`),
  };
}

export default async function Page({ params }: { params: { code: string; pageNum?: string } }) {
  const supabase = createClient();
  const currentPage = Number(params?.pageNum || 1);
  if (!Number.isInteger(currentPage) || currentPage < 2) notFound();
  const start = (currentPage - 1) * InfoPageSize;

  const [{ data: categoryList }, { data: navigationList, count }] = await Promise.all([
    supabase.from('navigation_category').select().eq('name', params.code),
    supabase
      .from('web_navigation')
      .select('*', { count: 'exact' })
      .eq('category_name', params.code)
      .range(start, start + InfoPageSize - 1),
  ]);

  if (!categoryList || !categoryList[0] || !navigationList?.length) {
    notFound();
  }

  return (
    <Content
      headerTitle={categoryList[0]!.title || params.code}
      navigationList={navigationList!}
      currentPage={currentPage}
      total={count!}
      pageSize={InfoPageSize}
      route={`/category/${params.code}`}
    />
  );
}
