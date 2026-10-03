'use server';
import { revalidatePath } from 'next/cache';
import { increment } from '../../lib/counter';

export async function incrementCounter(_formData: FormData): Promise<void> {
  increment();
  revalidatePath('/actions');
}
