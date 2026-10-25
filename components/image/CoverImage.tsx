'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import BaseImage from './BaseImage';

type CoverImageProps = {
  className?: string;
  imageClassName?: string;
  src?: string | null;
  title: string;
};

export default function CoverImage({ className, imageClassName, src, title }: CoverImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  const initial = title.trim().charAt(0).toUpperCase() || 'AI';

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden bg-gradient-to-br from-[#343852] via-[#292d44] to-[#171923]',
        className,
      )}
    >
      <div className='absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80'>
        <span className='flex size-12 items-center justify-center rounded-2xl bg-white/10 text-xl font-semibold shadow-inner shadow-white/10 backdrop-blur-sm lg:size-16 lg:text-2xl'>
          {initial}
        </span>
        <span className='max-w-[80%] truncate text-xs font-medium tracking-wide text-white/60 lg:text-sm'>{title}</span>
        <span className='text-[10px] uppercase tracking-[0.25em] text-white/30'>GetAITools</span>
      </div>
      {src && !failed && (
        <BaseImage
          src={src}
          alt={title}
          title={title}
          fill
          sizes='(min-width: 1024px) 466px, 100vw'
          onError={() => setFailed(true)}
          className={cn('absolute inset-0 z-10 size-full object-cover', imageClassName)}
        />
      )}
    </div>
  );
}
