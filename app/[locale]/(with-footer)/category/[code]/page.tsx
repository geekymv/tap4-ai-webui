/* eslint-disable react/jsx-props-no-spreading */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { countTools, getCategory, listTools } from '@/db/queries';

import { InfoPageSize, RevalidateOneHour } from '@/lib/constants';
import { languageAlternates } from '@/lib/seo';

import Content from './Content';

export const revalidate = RevalidateOneHour * 6;

export async function generateMetadata({ params }: { params: { code: string; locale: string } }): Promise<Metadata> {
  const category = await getCategory(params.code);

  if (!category) notFound();

  return {
    title: category.title,
    alternates: languageAlternates(params.locale, `/category/${params.code}`),
  };
}

export default async function Page({ params }: { params: { code: string } }) {
  const [category, navigationList, count] = await Promise.all([
    getCategory(params.code),
    listTools({ category: params.code, limit: InfoPageSize }),
    countTools(params.code),
  ]);

  if (!category) notFound();

  return (
    <Content
      headerTitle={category.title || params.code}
      navigationList={navigationList!}
      currentPage={1}
      total={count!}
      pageSize={InfoPageSize}
      route={`/category/${params.code}`}
    />
  );
}
