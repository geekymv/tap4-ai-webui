'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  clearReviewAdminSession,
  createReviewAdminSession,
  isReviewAdminAuthenticated,
  verifyReviewKey,
} from '@/lib/admin/review-auth';
import reviewCandidate, { ReviewAction } from '@/lib/crawler/review';
import createCrawlerStore from '@/lib/crawler/store';

const ADMIN_PATH = '/admin/crawl';

export async function login(formData: FormData) {
  const key = formData.get('key');
  if (typeof key !== 'string' || !verifyReviewKey(key)) {
    redirect(`${ADMIN_PATH}?error=invalid-key`);
  }
  createReviewAdminSession();
  redirect(ADMIN_PATH);
}

export async function logout() {
  clearReviewAdminSession();
  redirect(ADMIN_PATH);
}

export async function review(formData: FormData) {
  if (!isReviewAdminAuthenticated()) {
    clearReviewAdminSession();
    redirect(`${ADMIN_PATH}?error=session-expired`);
  }

  const id = Number(formData.get('id'));
  const requestedAction = formData.get('action');
  const categoryValue = formData.get('categoryName');
  if (!Number.isSafeInteger(id) || id < 1 || !['approve', 'reject'].includes(String(requestedAction))) {
    redirect(`${ADMIN_PATH}?error=invalid-request`);
  }

  const action = requestedAction as ReviewAction;
  const categoryName = typeof categoryValue === 'string' && categoryValue ? categoryValue : undefined;
  const store = createCrawlerStore();
  if (action === 'approve' && categoryName) {
    const categories = await store.listCategories();
    if (!categories.some((category) => category.name === categoryName)) {
      redirect(`${ADMIN_PATH}?error=invalid-category`);
    }
  }

  try {
    const result = await reviewCandidate(store, id, action, categoryName);
    if (result.status === 'published') {
      revalidatePath('/');
      revalidatePath('/explore');
      revalidatePath(`/category/${result.categoryName}`);
      revalidatePath(`/ai/${result.name}`);
    }
    revalidatePath(ADMIN_PATH);
  } catch (error) {
    const code =
      error instanceof Error && error.message.includes('candidate_not_reviewable')
        ? 'already-reviewed'
        : 'review-failed';
    redirect(`${ADMIN_PATH}?error=${code}`);
  }

  redirect(`${ADMIN_PATH}?result=${action === 'approve' ? 'published' : 'rejected'}`);
}
