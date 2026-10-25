import { type MetadataRoute } from 'next';
import { createClient } from '@/db/supabase/client';
import { locales } from '@/i18n';

import { InfoPageSize } from '@/lib/constants';
import { intentPages } from '@/lib/intent-pages';
import { localizedUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const EXPLORE_PAGE_SIZE = 12;
const DATABASE_PAGE_SIZE = 1000;

type Route = Omit<MetadataRoute.Sitemap[number], 'url'> & { path: string };
type SitemapTool = { name: string; collection_time: string };

async function fetchAllTools(client: ReturnType<typeof createClient>, offset = 0): Promise<SitemapTool[]> {
  const { data, error } = await client
    .from('web_navigation')
    .select('name, collection_time')
    .order('id')
    .range(offset, offset + DATABASE_PAGE_SIZE - 1);
  if (error || !data?.length) return [];
  if (data.length < DATABASE_PAGE_SIZE) return data;
  return [...data, ...(await fetchAllTools(client, offset + DATABASE_PAGE_SIZE))];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();
  const now = new Date();
  const routes: Route[] = [
    { path: '', lastModified: now, changeFrequency: 'daily', priority: 1 },
    { path: '/explore', lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { path: '/submit', lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { path: '/startup', lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { path: '/editorial-methodology', lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    ...intentPages.map(({ slug }) => ({
      path: `/best/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];

  const [{ data: categories }, { count: toolCount }] = await Promise.all([
    supabase.from('navigation_category').select('name'),
    supabase.from('web_navigation').select('id', { count: 'exact', head: true }),
  ]);

  const explorePages = Math.ceil((toolCount || 0) / EXPLORE_PAGE_SIZE);
  for (let page = 2; page <= explorePages; page += 1) {
    routes.push({ path: `/explore/page/${page}`, lastModified: now, changeFrequency: 'daily', priority: 0.7 });
  }

  await Promise.all(
    (categories || []).map(async (category) => {
      routes.push({ path: `/category/${category.name}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 });
      const { count } = await supabase
        .from('web_navigation')
        .select('id', { count: 'exact', head: true })
        .eq('category_name', category.name);
      const pageCount = Math.ceil((count || 0) / InfoPageSize);
      for (let page = 2; page <= pageCount; page += 1) {
        routes.push({
          path: `/category/${category.name}/page/${page}`,
          lastModified: now,
          changeFrequency: 'daily',
          priority: 0.6,
        });
      }
    }),
  );

  const tools = await fetchAllTools(supabase);
  tools.forEach((tool) =>
    routes.push({
      path: `/ai/${encodeURIComponent(tool.name)}`,
      lastModified: tool.collection_time ? new Date(tool.collection_time) : now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }),
  );

  return routes.flatMap((route) =>
    locales.map((locale) => ({
      url: localizedUrl(locale, route.path),
      lastModified: route.lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
  );
}
