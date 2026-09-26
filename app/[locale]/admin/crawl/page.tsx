import type { Metadata } from 'next';

import { getReviewAuthKey, isReviewAdminAuthenticated } from '@/lib/admin/review-auth';
import createCrawlerStore from '@/lib/crawler/store';

import { login, logout, review } from './actions';
import CandidateDetail from './CandidateDetail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Crawler review',
};

const ADMIN_PATH = '/admin/crawl';
const PAGE_SIZE = 12;

const errors: Record<string, string> = {
  'already-reviewed': '该候选已被其他管理员处理，请刷新列表。',
  'invalid-category': '所选分类无效。',
  'invalid-key': '审核密钥不正确。',
  'invalid-request': '审核请求无效。',
  'review-failed': '审核操作失败，请查看服务端日志。',
  'session-expired': '登录已过期，请重新输入审核密钥。',
};

const results: Record<string, string> = {
  published: '候选已批准并发布。',
  rejected: '候选已拒绝。',
  'rewrite-queued': '候选已加入重新抓取和清洗队列。',
};

function Login({ error }: { error?: string }) {
  const configured = Boolean(getReviewAuthKey());
  return (
    <main className='mx-auto flex w-full max-w-md flex-1 items-center px-6 py-16'>
      <section className='w-full rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl'>
        <p className='text-sm font-medium uppercase tracking-[0.2em] text-purple-300'>GetAITools Admin</p>
        <h1 className='mt-2 text-2xl font-semibold'>候选网站审核</h1>
        <p className='mt-2 text-sm text-gray-400'>
          请输入生产环境中的 REVIEW_AUTH_KEY。密钥只提交到服务端，不会保存到浏览器存储。
        </p>
        {!configured && (
          <p className='mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200'>
            服务端尚未配置 REVIEW_AUTH_KEY。
          </p>
        )}
        {error && (
          <p role='alert' className='mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200'>
            {errors[error] || '登录失败。'}
          </p>
        )}
        <form action={login} className='mt-6 space-y-4'>
          <div className='text-sm text-gray-300'>
            <span id='review-key-label'>审核密钥</span>
            <input
              name='key'
              type='password'
              aria-labelledby='review-key-label'
              autoComplete='current-password'
              maxLength={512}
              required
              disabled={!configured}
              className='mt-2 h-11 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-white outline-none ring-purple-400 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50'
            />
          </div>
          <button
            type='submit'
            disabled={!configured}
            className='h-11 w-full rounded-lg bg-purple-600 px-4 font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50'
          >
            登录审核台
          </button>
        </form>
      </section>
    </main>
  );
}

export default async function CrawlAdminPage({
  searchParams,
}: {
  searchParams?: { error?: string; page?: string; result?: string };
}) {
  if (!isReviewAdminAuthenticated()) return <Login error={searchParams?.error} />;

  const requestedPage = Number(searchParams?.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1_000_000) : 1;
  const store = createCrawlerStore();
  const [{ items, total }, categories] = await Promise.all([
    store.listReviewCandidates((page - 1) * PAGE_SIZE, PAGE_SIZE),
    store.listCategories(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className='mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8'>
      <header className='flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <p className='text-sm font-medium uppercase tracking-[0.2em] text-purple-300'>GetAITools Admin</p>
          <h1 className='mt-2 text-3xl font-semibold'>候选网站审核</h1>
          <p className='mt-2 text-sm text-gray-400'>共 {total} 条待审核记录，按抓取完成时间从早到晚排列。</p>
        </div>
        <form action={logout}>
          <button
            type='submit'
            className='rounded-lg border border-white/15 px-4 py-2 text-sm text-gray-200 transition hover:bg-white/10'
          >
            退出登录
          </button>
        </form>
      </header>

      {searchParams?.error && (
        <p role='alert' className='mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200'>
          {errors[searchParams.error] || '操作失败。'}
        </p>
      )}
      {searchParams?.result && (
        <p
          role='status'
          className='mt-6 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200'
        >
          {results[searchParams.result] || '操作成功。'}
        </p>
      )}

      {items.length === 0 ? (
        <section className='mt-8 rounded-2xl border border-dashed border-white/15 p-12 text-center text-gray-400'>
          当前没有待审核候选。
        </section>
      ) : (
        <section className='mt-8 grid gap-6 lg:grid-cols-2'>
          {items.map((candidate) => (
            <article
              key={candidate.id}
              className='overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg'
            >
              {candidate.image_url && (
                // Arbitrary crawler image hosts cannot be declared in the static Next Image configuration.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={candidate.image_url}
                  alt=''
                  loading='lazy'
                  referrerPolicy='no-referrer'
                  className='h-48 w-full bg-black/30 object-cover'
                />
              )}
              <div className='p-5'>
                <div className='flex flex-wrap items-center gap-2 text-xs text-gray-400'>
                  <span className='rounded-full bg-purple-500/15 px-2.5 py-1 text-purple-200'>{candidate.source}</span>
                  <span>#{candidate.id}</span>
                  <time dateTime={new Date(candidate.updated_at).toISOString()}>
                    {new Date(candidate.updated_at).toLocaleString('zh-CN')}
                  </time>
                </div>
                <h2 className='mt-4 text-xl font-semibold text-white'>{candidate.title || candidate.domain}</h2>
                <a
                  href={candidate.canonical_url}
                  target='_blank'
                  rel='noreferrer'
                  className='mt-1 block break-all text-sm text-purple-300 hover:text-purple-200 hover:underline'
                >
                  {candidate.canonical_url}
                </a>
                {candidate.source_url && (
                  <a
                    href={candidate.source_url}
                    target='_blank'
                    rel='noreferrer'
                    className='mt-1 block break-all text-xs text-gray-400 hover:text-gray-300 hover:underline'
                  >
                    查看来源
                  </a>
                )}
                <p className='mt-4 text-sm leading-6 text-gray-300'>{candidate.description || '暂无描述'}</p>
                {candidate.has_detail && <CandidateDetail candidateId={candidate.id} />}

                <form action={review} className='mt-5 space-y-4 border-t border-white/10 pt-5'>
                  <input type='hidden' name='id' value={candidate.id} />
                  <div className='text-sm text-gray-300'>
                    <span id={`category-label-${candidate.id}`}>发布分类</span>
                    <select
                      name='categoryName'
                      aria-labelledby={`category-label-${candidate.id}`}
                      defaultValue={candidate.category_name || ''}
                      className='mt-2 h-11 w-full rounded-lg border border-white/15 bg-[#222129] px-3 text-sm text-white outline-none ring-purple-400 focus:ring-2'
                    >
                      <option value=''>使用自动分类（无匹配时为 other）</option>
                      {categories.map((category) => (
                        <option key={category.name} value={category.name}>
                          {category.title ? `${category.title} (${category.name})` : category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='grid gap-3 sm:grid-cols-3'>
                    <button
                      type='submit'
                      name='action'
                      value='reject'
                      className='h-11 rounded-lg border border-red-400/30 bg-red-500/10 font-medium text-red-200 transition hover:bg-red-500/20'
                    >
                      拒绝
                    </button>
                    <button
                      type='submit'
                      name='action'
                      value='rewrite'
                      className='h-11 rounded-lg border border-amber-400/30 bg-amber-500/10 font-medium text-amber-100 transition hover:bg-amber-500/20'
                    >
                      重新生成
                    </button>
                    <button
                      type='submit'
                      name='action'
                      value='approve'
                      className='h-11 rounded-lg bg-green-600 font-medium text-white transition hover:bg-green-500'
                    >
                      批准并发布
                    </button>
                  </div>
                </form>
              </div>
            </article>
          ))}
        </section>
      )}

      {totalPages > 1 && (
        <nav aria-label='审核列表分页' className='mt-8 flex items-center justify-center gap-4 text-sm'>
          {page > 1 ? (
            <a
              href={`${ADMIN_PATH}?page=${page - 1}`}
              className='rounded-lg border border-white/15 px-4 py-2 hover:bg-white/10'
            >
              上一页
            </a>
          ) : (
            <span className='rounded-lg border border-white/5 px-4 py-2 text-gray-600'>上一页</span>
          )}
          <span className='text-gray-400'>
            第 {page} / {totalPages} 页
          </span>
          {page < totalPages ? (
            <a
              href={`${ADMIN_PATH}?page=${page + 1}`}
              className='rounded-lg border border-white/15 px-4 py-2 hover:bg-white/10'
            >
              下一页
            </a>
          ) : (
            <span className='rounded-lg border border-white/5 px-4 py-2 text-gray-600'>下一页</span>
          )}
        </nav>
      )}
    </main>
  );
}
