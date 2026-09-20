const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'referrer', 'source']);

export function normalizeUrl(input: string) {
  const url = new URL(input.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported');
  if (url.username || url.password) throw new Error('URLs containing credentials are not supported');

  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  url.hash = '';
  Array.from(url.searchParams.keys()).forEach((key) => {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  });
  url.searchParams.sort();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

export function getDomain(input: string) {
  return new URL(input).hostname.toLowerCase();
}
