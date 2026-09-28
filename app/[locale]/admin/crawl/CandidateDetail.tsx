'use client';

import { useState } from 'react';
import Markdown, { Components } from 'react-markdown';

const reviewMarkdownComponents: Components = {
  a: ({ children }) => <span>{children}</span>,
  img: () => null,
};

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export default function CandidateDetail({ candidateId }: { candidateId: number }) {
  const [detail, setDetail] = useState('');
  const [state, setState] = useState<LoadState>('idle');

  async function loadDetail() {
    setState('loading');
    try {
      const response = await fetch(`/api/crawl/review/${candidateId}/detail`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load candidate detail');
      const body = (await response.json()) as { detail?: string | null };
      setDetail(body.detail || '暂无待发布内容');
      setState('loaded');
    } catch {
      setState('error');
    }
  }

  return (
    <details
      className='mt-4 rounded-lg border border-white/10 bg-black/20 p-3'
      onToggle={(event) => {
        if (event.currentTarget.open && (state === 'idle' || state === 'error')) loadDetail();
      }}
    >
      <summary className='cursor-pointer text-sm text-gray-300'>查看待发布内容（Markdown 预览）</summary>
      {state === 'loading' && <p className='mt-3 text-xs text-gray-400'>正在加载待发布内容…</p>}
      {state === 'error' && (
        <p role='alert' className='mt-3 text-xs text-red-300'>
          待发布内容加载失败，请收起后重新展开重试。
        </p>
      )}
      {state === 'loaded' && (
        <div className='mt-3 max-h-96 overflow-auto rounded-md bg-black/20 p-4'>
          <Markdown
            skipHtml
            components={reviewMarkdownComponents}
            className='prose prose-sm prose-invert max-w-none break-words text-gray-300 prose-headings:mb-2 prose-headings:mt-5 prose-headings:text-white prose-p:my-2 prose-p:leading-6 prose-li:my-1'
          >
            {detail}
          </Markdown>
        </div>
      )}
    </details>
  );
}
