/* eslint-disable react/jsx-props-no-spreading */
import { WebNavigation } from '@/db/types';
import { useLocale, useTranslations } from 'next-intl';

import { getIntentLocale, intentPages } from '@/lib/intent-pages';
import Empty from '@/components/Empty';
import ExploreBreadcrumb from '@/components/explore/ExploreBreadcrumb';
import BasePagination from '@/components/page/BasePagination';
import WebNavCard from '@/components/webNav/WebNavCard';
import { Link } from '@/app/navigation';

export default function Content({
  headerTitle,
  navigationList,
  currentPage,
  total,
  pageSize,
  route,
}: {
  headerTitle: string;
  navigationList: WebNavigation[];
  currentPage: number;
  total: number;
  pageSize: number;
  route: string;
}) {
  const t = useTranslations('Category');
  const locale = getIntentLocale(useLocale());
  const categoryCode = route.split('/').filter(Boolean).at(-1);
  const relatedIntents = intentPages.filter(({ category }) => category === categoryCode);

  return (
    <>
      <div className='mx-auto flex flex-col gap-3 py-5 lg:pt-10'>
        <h1 className='text-center text-[28px] font-bold lg:text-5xl'>{headerTitle}</h1>
        <div className='mx-auto'>
          <ExploreBreadcrumb
            linkList={[
              {
                href: '/',
                title: t('home'),
              },
              {
                title: headerTitle,
                isLast: true,
              },
            ]}
          />
        </div>
      </div>
      {relatedIntents.length > 0 && (
        <nav className='flex flex-wrap justify-center gap-2' aria-label={headerTitle}>
          {relatedIntents.map((intent) => (
            <Link
              key={intent.slug}
              href={`/best/${intent.slug}`}
              className='rounded-full border border-white/20 px-3 py-1 text-sm text-white/70 hover:border-white hover:text-white'
            >
              {intent.labels[locale]}
            </Link>
          ))}
        </nav>
      )}
      <div className='mt-3'>
        {navigationList && !!navigationList?.length ? (
          <>
            <div className='grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4'>
              {navigationList.map((item) => (
                <WebNavCard key={item.id} {...item} />
              ))}
            </div>
            <div className='my-5 flex items-center justify-center lg:my-10'>
              <BasePagination
                currentPage={currentPage}
                total={total}
                pageSize={pageSize}
                route={route}
                subRoute='/page'
              />
            </div>
          </>
        ) : (
          <div className='mb-3 lg:mb-5'>
            <Empty title={t('empty')} />
          </div>
        )}
      </div>
    </>
  );
}
