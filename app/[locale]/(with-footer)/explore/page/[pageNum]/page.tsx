import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { RevalidateOneHour } from '@/lib/constants';
import { languageAlternates } from '@/lib/seo';

import ExploreList from '../../ExploreList';

export const revalidate = RevalidateOneHour * 6;

export async function generateMetadata({ params }: { params: { locale: string; pageNum: string } }): Promise<Metadata> {
  const page = Number(params.pageNum);
  if (!Number.isInteger(page) || page < 2) notFound();
  const t = await getTranslations({ locale: params.locale, namespace: 'Metadata.explore' });
  return {
    title: `${t('title')} · ${page}`,
    description: t('description'),
    alternates: languageAlternates(params.locale, `/explore/page/${page}`),
  };
}

export default function Page({ params: { pageNum } }: { params: { pageNum: string } }) {
  const page = Number(pageNum);
  if (!Number.isInteger(page) || page < 2) notFound();
  return <ExploreList pageNum={pageNum} />;
}
