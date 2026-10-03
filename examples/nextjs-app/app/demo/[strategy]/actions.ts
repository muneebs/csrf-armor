'use server';
import {revalidatePath} from 'next/cache';
import {increment} from '../../../lib/counter';
import {isStrategy} from '../../../lib/strategies';

// Server action calls are POSTs to /demo/<strategy>, so middleware.ts checks
// them with that strategy (the csrf_token form field) before this runs.
// Keep the formData parameter even though it is unused: Next.js only sends
// the arguments an action declares, and the token travels in formData.
export async function incrementForDemo(strategy: string, _formData: FormData): Promise<number> {
    if (!isStrategy(strategy)) throw new Error('Unknown strategy');
    const count = increment();
    revalidatePath(`/demo/${strategy}`);
    return count;
}
