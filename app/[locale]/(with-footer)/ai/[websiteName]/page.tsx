/* eslint-disable react/jsx-props-no-spreading */
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { createClient } from '@/db/supabase/client';
import { CircleArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import detailCopy from '@/lib/detail-copy';
import { CONTACT_US_EMAIL } from '@/lib/env';
import { getIntentLocale } from '@/lib/intent-pages';
import { languageAlternates, localizedUrl, safeJsonLd } from '@/lib/seo';
import { Separator } from '@/components/ui/separator';
import CoverImage from '@/components/image/CoverImage';
import MarkdownProse from '@/components/MarkdownProse';
import WebNavCard from '@/components/webNav/WebNavCard';
import { Link } from '@/app/navigation';

export async function generateMetadata({
  params: { locale, websiteName },
}: {
  params: { locale: string; websiteName: string };
}): Promise<Metadata> {
  const supabase = createClient();
  const t = await getTranslations({ locale, namespace: 'Metadata.ai' });
  const { data } = await supabase.from('web_navigation').select().eq('name', websiteName).maybeSingle();

  if (!data) notFound();

  const title = `${data.title} | ${t('titleSubfix')}`;
  const path = `/ai/${data.name}`;
  return {
    title,
    description: data.content,
    alternates: languageAlternates(locale, path),
    openGraph: {
      title,
      description: data.content,
      url: localizedUrl(locale, path),
      type: 'website',
      images: data.thumbnail_url ? [{ url: data.thumbnail_url, alt: data.title }] : undefined,
    },
    twitter: {
      card: data.thumbnail_url ? 'summary_large_image' : 'summary',
      title,
      description: data.content,
      images: data.thumbnail_url ? [data.thumbnail_url] : undefined,
    },
  };
}

export default async function Page({
  params: { locale, websiteName },
}: {
  params: { locale: string; websiteName: string };
}) {
  const supabase = createClient();
  const t = await getTranslations({ locale, namespace: 'Startup.detail' });
  const { data } = await supabase.from('web_navigation').select().eq('name', websiteName).maybeSingle();
  if (!data) notFound();

  const { data: similarTools } = await supabase
    .from('web_navigation')
    .select('*')
    .eq('category_name', data.category_name)
    .neq('id', data.id)
    .order('collection_time', { ascending: false })
    .limit(4);
  const copy = detailCopy[getIntentLocale(locale)];
  const tags =
    data.tag_name
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean) || [];
  const dateLocales: Record<string, string> = { jp: 'ja-JP', cn: 'zh-CN', tw: 'zh-TW' };
  const dateLocale = dateLocales[locale] || locale;
  const catalogDate = data.collection_time
    ? new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium' }).format(new Date(data.collection_time))
    : null;
  const detailUrl = localizedUrl(locale, `/ai/${data.name}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: data.title,
        description: data.content,
        url: detailUrl,
        applicationCategory: data.category_name,
        image: data.thumbnail_url || undefined,
        sameAs: data.url,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: copy.breadcrumbHome, item: localizedUrl(locale) },
          {
            '@type': 'ListItem',
            position: 2,
            name: data.category_name,
            item: localizedUrl(locale, `/category/${data.category_name}`),
          },
          { '@type': 'ListItem', position: 3, name: data.title, item: detailUrl },
        ],
      },
    ],
  };
  const reportHref = CONTACT_US_EMAIL
    ? `mailto:${CONTACT_US_EMAIL}?subject=${encodeURIComponent(`Outdated tool: ${data.title}`)}&body=${encodeURIComponent(detailUrl)}`
    : null;

  return (
    <div className='w-full'>
      <Script
        id={`tool-${data.id}`}
        type='application/ld+json'
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <nav className='px-6 pt-5 text-sm text-white/60 lg:px-0' aria-label='Breadcrumb'>
        <Link href='/' className='hover:text-white'>
          {copy.breadcrumbHome}
        </Link>
        <span aria-hidden='true'> / </span>
        <Link href={`/category/${data.category_name}`} className='hover:text-white'>
          {data.category_name}
        </Link>
        <span aria-hidden='true'> / </span>
        <span className='text-white'>{data.title}</span>
      </nav>
      <div className='flex flex-col px-6 py-5 lg:h-[323px] lg:flex-row lg:justify-between lg:px-0 lg:py-10'>
        <div className='flex flex-col items-center lg:items-start'>
          <div className='space-y-1 text-balance lg:space-y-3'>
            <h1 className='text-2xl lg:text-5xl'>{data.title}</h1>
            <p className='text-xs lg:text-sm'>{data.content}</p>
          </div>
          <a
            href={data.url}
            target='_blank'
            rel='nofollow noreferrer'
            className='flex-center mt-5 min-h-5 w-full gap-1 rounded-[8px] bg-white p-[10px] text-sm capitalize text-black hover:opacity-80 lg:mt-auto lg:w-[288px]'
          >
            {t('visitWebsite')} <CircleArrowRight className='size-[14px]' />
          </a>
        </div>
        <a
          href={data.url}
          target='_blank'
          rel='nofollow noreferrer'
          className='flex-center group relative h-[171px] w-full flex-shrink-0 lg:h-[234px] lg:w-[466px]'
        >
          <CoverImage
            title={data.title}
            src={data.thumbnail_url || ''}
            className='absolute inset-0 mt-3 aspect-[466/234] w-full rounded-[16px] border border-[#424242] lg:mt-0'
          />
          <div className='absolute inset-0 z-10 hidden items-center justify-center gap-1 rounded-[16px] bg-black bg-opacity-50 text-2xl text-white transition-all duration-200 group-hover:flex'>
            {t('visitWebsite')} <CircleArrowRight className='size-5' />
          </div>
        </a>
      </div>
      <Separator className='bg-[#010101]' />

      <section className='mx-3 my-6 rounded-xl bg-[#2C2D36] p-5 lg:mx-0' aria-labelledby='selection-summary'>
        <h2 id='selection-summary' className='text-xl font-semibold'>
          {copy.summary}
        </h2>
        <dl className='mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4'>
          <div>
            <dt className='text-white/50'>{copy.category}</dt>
            <dd className='mt-1'>
              <Link href={`/category/${data.category_name}`} className='underline'>
                {data.category_name}
              </Link>
            </dd>
          </div>
          {tags.length > 0 && (
            <div>
              <dt className='text-white/50'>{copy.tags}</dt>
              <dd className='mt-1'>{tags.join(', ')}</dd>
            </div>
          )}
          {data.star_rating > 0 && (
            <div>
              <dt className='text-white/50'>{copy.rating}</dt>
              <dd className='mt-1'>{data.star_rating}</dd>
            </div>
          )}
          {catalogDate && (
            <div>
              <dt className='text-white/50'>{copy.cataloged}</dt>
              <dd className='mt-1'>
                <time dateTime={data.collection_time}>{catalogDate}</time>
              </dd>
            </div>
          )}
          <div>
            <dt className='text-white/50'>{copy.pricing}</dt>
            <dd className='mt-1'>{copy.pricingValue}</dd>
          </div>
        </dl>
      </section>

      <div className='mb-5 px-3 lg:px-0'>
        <h2 className='my-5 text-2xl text-white/40 lg:my-10'>{t('introduction')}</h2>
        <MarkdownProse markdown={data.detail || ''} />
      </div>

      <section
        className='mx-3 my-8 rounded-xl border border-white/10 p-5 lg:mx-0'
        aria-labelledby='catalog-transparency'
      >
        <h2 id='catalog-transparency' className='text-xl font-semibold'>
          {copy.trust}
        </h2>
        <dl className='mt-4 space-y-3 text-sm'>
          <div>
            <dt className='text-white/50'>{copy.source}</dt>
            <dd>{copy.sourceValue}</dd>
          </div>
          {catalogDate && (
            <div>
              <dt className='text-white/50'>{copy.checked}</dt>
              <dd>{catalogDate}</dd>
            </div>
          )}
        </dl>
        <p className='mt-4 text-sm leading-6 text-white/70'>{copy.notVerified}</p>
        <div className='mt-4 flex flex-wrap gap-4 text-sm underline'>
          <Link href='/editorial-methodology'>{copy.editorial}</Link>
          {reportHref && <a href={reportHref}>{copy.report}</a>}
        </div>
      </section>

      {!!similarTools?.length && (
        <section className='mx-3 my-10 lg:mx-0' aria-labelledby='similar-tools'>
          <h2 id='similar-tools' className='text-2xl font-semibold'>
            {copy.similar}
          </h2>
          <div className='mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4'>
            {similarTools.map((tool) => (
              <WebNavCard key={tool.id} {...tool} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
