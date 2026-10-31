import { NextRequest, NextResponse } from 'next/server';
import { createSubmission } from '@/db/queries';
import { z } from 'zod';

const submissionSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().trim().min(1).max(120),
  url: z
    .string()
    .url()
    .max(2048)
    .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)),
});

export async function POST(req: NextRequest) {
  try {
    const input = submissionSchema.parse(await req.json());
    await createSubmission(input);
    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid submission' }, { status: 400 });
    }
    console.error('Submission failed', error);
    return NextResponse.json({ error: 'Unable to save submission' }, { status: 500 });
  }
}
