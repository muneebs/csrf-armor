'use server';
import {revalidatePath} from 'next/cache';
import {increment} from '../../lib/counter';

// _formData must stay: Next.js only sends declared arguments, and the token is in it.
export async function incrementCounter(_formData: FormData): Promise<void> {
    increment();
    revalidatePath('/actions');
}
