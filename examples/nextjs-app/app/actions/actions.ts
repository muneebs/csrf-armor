'use server';
import {revalidatePath} from 'next/cache';
import {increment} from '../../lib/counter';

// Server actions are POSTs to the page URL, so middleware.ts validates their
// CSRF token (the csrf_token form field) before this runs.
// Keep the formData parameter even though it is unused: Next.js only sends
// the arguments an action declares, and the token travels in formData.
export async function incrementCounter(_formData: FormData): Promise<void> {
    increment();
    revalidatePath('/actions');
}
