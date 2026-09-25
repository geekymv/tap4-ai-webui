import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

export default function verifyWorkerAuthorization(authorization: string | null) {
  const expected = process.env.CRAWLER_WORKER_KEY || '';
  if (!expected || !authorization?.startsWith('Bearer ')) return false;
  return timingSafeEqual(digest(authorization.slice('Bearer '.length)), digest(expected));
}
