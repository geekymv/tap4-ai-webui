'use client';

import { useState } from 'react';

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
      setDetail(body.detail || '暂无抓取正文');
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
      <summary className='cursor-pointer text-sm text-gray-300'>查看抓取正文</summary>
      {state === 'loading' && <p className='mt-3 text-xs text-gray-400'>正在加载正文…</p>}
      {state === 'error' && (
        <p role='alert' className='mt-3 text-xs text-red-300'>
          正文加载失败，请收起后重新展开重试。
        </p>
      )}
      {state === 'loaded' && (
        <pre className='mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-5 text-gray-400'>
          {detail}
        </pre>
      )}
    </details>
  );
}
