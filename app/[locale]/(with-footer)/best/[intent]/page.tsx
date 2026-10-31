/* eslint-disable react/jsx-props-no-spreading */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { listTools } from '@/db/queries';

import { getIntentLocale, getIntentPage, intentCopy, intentPages, interpolate } from '@/lib/intent-pages';
import { languageAlternates, localizedUrl, safeJsonLd } from '@/lib/seo';
import WebNavCard from '@/components/webNav/WebNavCard';

export const revalidate = 21600;

export function generateStaticParams() {
  return intentPages.map(({ slug }) => ({ intent: slug }));
}

export async function generateMetadata({ params }: { params: { locale: string; intent: string } }): Promise<Metadata> {
  const page = getIntentPage(params.intent);
  if (!page) notFound();

  const locale = getIntentLocale(params.locale);
  const name = page.labels[locale];
  const title = interpolate(intentCopy[locale].title, name);
  const description = interpolate(intentCopy[locale].description, name);
  const path = `/best/${page.slug}`;

  return {
    title,
    description,
    alternates: languageAlternates(params.locale, path),
    openGraph: { title, description, url: localizedUrl(params.locale, path), type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

export default async function IntentPage({ params }: { params: { locale: string; intent: string } }) {
  const page = getIntentPage(params.intent);
  if (!page) notFound();

  const locale = getIntentLocale(params.locale);
  const copy = intentCopy[locale];
  const name = page.labels[locale];
  const title = interpolate(copy.title, name);
  const tools = await listTools({ category: page.category, limit: 12, order: 'collection_time_desc' });
  const path = `/best/${page.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description: interpolate(copy.description, name),
    url: localizedUrl(params.locale, path),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: tools?.length || 0,
      itemListElement: (tools || []).map((tool, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: tool.title,
        url: localizedUrl(params.locale, `/ai/${tool.name}`),
      })),
    },
  };

  return (
    <main className='mx-auto w-full max-w-pc px-3 py-8 lg:px-0 lg:py-12'>
      <Script
        id={`intent-${page.slug}`}
        type='application/ld+json'
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <header className='mx-auto max-w-3xl text-center'>
        <h1 className='text-3xl font-bold lg:text-5xl'>{title}</h1>
        <p className='mt-5 text-sm leading-7 text-white/70 lg:text-base'>{copy.intro}</p>
        <p className='mt-2 text-sm leading-7 text-white/70'>{copy.catalogNote}</p>
      </header>

      {tools?.length ? (
        <section className='mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4' aria-label={name}>
          {tools.map((tool) => (
            <WebNavCard key={tool.id} {...tool} />
          ))}
        </section>
      ) : (
        <p className='mt-10 text-center text-white/60'>{copy.empty}</p>
      )}

      <section className='mx-auto mt-12 max-w-3xl rounded-xl bg-[#2C2D36] p-6'>
        <h2 className='text-2xl font-semibold'>{copy.faqTitle}</h2>
        <div className='mt-5 space-y-5'>
          {copy.faq.map(([question, answer]) => (
            <div key={question}>
              <h3 className='font-semibold'>{question}</h3>
              <p className='mt-1 text-sm leading-6 text-white/70'>{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
