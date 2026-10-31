import { type MetadataRoute } from 'next';
import { countTools, listCategories, listSitemapTools } from '@/db/queries';
import { locales } from '@/i18n';

import { InfoPageSize } from '@/lib/constants';
import { intentPages } from '@/lib/intent-pages';
import { localizedUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const EXPLORE_PAGE_SIZE = 12;
const DATABASE_PAGE_SIZE = 1000;

type Route = Omit<MetadataRoute.Sitemap[number], 'url'> & { path: string };
type SitemapTool = { name: string; collection_time: string };

async function fetchAllTools(offset = 0): Promise<SitemapTool[]> {
  const data = await listSitemapTools(offset, DATABASE_PAGE_SIZE);
  if (!data.length) return [];
  if (data.length < DATABASE_PAGE_SIZE) return data as SitemapTool[];
  return [...(data as SitemapTool[]), ...(await fetchAllTools(offset + DATABASE_PAGE_SIZE))];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  const [categories, toolCount] = await Promise.all([listCategories(), countTools()]);

  const explorePages = Math.ceil((toolCount || 0) / EXPLORE_PAGE_SIZE);
  for (let page = 2; page <= explorePages; page += 1) {
    routes.push({ path: `/explore/page/${page}`, lastModified: now, changeFrequency: 'daily', priority: 0.7 });
  }

  await Promise.all(
    (categories || []).map(async (category) => {
      routes.push({ path: `/category/${category.name}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 });
      const count = await countTools(category.name);
      const pageCount = Math.ceil(count / InfoPageSize);
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

  const tools = await fetchAllTools();
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
