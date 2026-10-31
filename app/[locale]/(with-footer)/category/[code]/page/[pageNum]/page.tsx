/* eslint-disable react/jsx-props-no-spreading */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { countTools, getCategory, listTools } from '@/db/queries';

import { InfoPageSize, RevalidateOneHour } from '@/lib/constants';
import { languageAlternates } from '@/lib/seo';

import Content from '../../Content';

export const revalidate = RevalidateOneHour * 6;

export async function generateMetadata({
  params,
}: {
  params: { code: string; locale: string; pageNum?: string };
}): Promise<Metadata> {
  const category = await getCategory(params.code);
  if (!category) notFound();

  const page = Number(params.pageNum || 1);
  return {
    title: `${category.title} · ${page}`,
    alternates: languageAlternates(params.locale, `/category/${params.code}/page/${page}`),
  };
}

export default async function Page({ params }: { params: { code: string; pageNum?: string } }) {
  const currentPage = Number(params?.pageNum || 1);
  if (!Number.isInteger(currentPage) || currentPage < 2) notFound();
  const start = (currentPage - 1) * InfoPageSize;

  const [category, navigationList, count] = await Promise.all([
    getCategory(params.code),
    listTools({ category: params.code, limit: InfoPageSize, offset: start }),
    countTools(params.code),
  ]);

  if (!category || !navigationList.length) notFound();

  return (
    <Content
      headerTitle={category.title || params.code}
      navigationList={navigationList!}
      currentPage={currentPage}
      total={count!}
      pageSize={InfoPageSize}
      route={`/category/${params.code}`}
    />
  );
}
