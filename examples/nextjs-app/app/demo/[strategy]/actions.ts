'use server';
import {revalidatePath} from 'next/cache';
import {increment} from '../../../lib/counter';
import {isStrategy} from '../../../lib/strategies';

// _formData must stay: Next.js only sends declared arguments, and the token is in it.
export async function incrementForDemo(strategy: string, _formData: FormData): Promise<number> {
    if (!isStrategy(strategy)) throw new Error('Unknown strategy');
    const count = increment();
    revalidatePath(`/demo/${strategy}`);
    return count;
}
